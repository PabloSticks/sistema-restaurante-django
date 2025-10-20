# gestion/views.py
from decimal import Decimal
from django.contrib.auth.models import User
# Importaciones de DRF limpias y ordenadas
from rest_framework import viewsets, permissions, mixins
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
# Importaciones de SimpleJWT (solo las necesarias para la vista personalizada)
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
# Importa la función para enviar eventos SSE
from django_eventstream import send_event

# Importa TODOS tus modelos necesarios
from .models import Mesa, Categoria, Producto, Pedido, PedidoDetalle, Turno

# Importa TODOS tus serializers necesarios
from .serializers import (
    MesaWithPedidosSerializer,
    CategoriaSerializer,
    ProductoSerializer,
    PedidoReadSerializer,
    PedidoCreateSerializer,
    PedidoUpdateSerializer,
    PedidoDetalleUpdateSerializer,
    UserSerializer # Serializer para /users/me/
    # No es necesario importar MyTokenObtainPairSerializer aquí
)

# Importa tus permisos personalizados
from .permissions import IsMeseroUser, IsCocinaUser


# --- VISTAS PRINCIPALES DE LA API (VIEWSETS) ---

class MesaViewSet(viewsets.ModelViewSet):
    """
    API endpoint para ver y editar mesas (solo Meseros).
    Incluye acción para calcular el total.
    """
    queryset = Mesa.objects.all().order_by('numero') # Ordenamos por número de mesa
    serializer_class = MesaWithPedidosSerializer
    permission_classes = [IsMeseroUser] # Solo meseros pueden acceder

    @action(detail=True, methods=['get'])
    def calcular_total(self, request, pk=None):
        """
        Calcula el total de los pedidos no pagados de la mesa.
        Devuelve error 400 si hay items no entregados.
        """
        mesa = self.get_object()
        total = Decimal('0.00')
        # Obtenemos pedidos activos de esta mesa
        pedidos_a_cobrar = mesa.pedidos.exclude(estado='pagado')

        # Verificación: ¿Hay items no entregados en esos pedidos?
        items_pendientes = PedidoDetalle.objects.filter(
            pedido__in=pedidos_a_cobrar # Busca detalles SOLO en los pedidos a cobrar
        ).exclude(estado='entregado') # Excluye los que ya están entregados

        if items_pendientes.exists():
            print(f"Intento de cobro fallido para Mesa {pk}: Items pendientes encontrados.") # Log para depuración
            return Response(
                {'error': 'No se puede cobrar, aún hay items pendientes de entrega.'},
                status=400 # Bad Request
            )

        # Si no hay pendientes, calcula el total
        for pedido in pedidos_a_cobrar:
            for detalle in pedido.detalles.all(): # .all() aquí está bien porque ya filtramos los pedidos
                total += detalle.precio_unitario * detalle.cantidad

        print(f"Total calculado para Mesa {pk}: {total}") # Log para depuración
        return Response({'total': total})


class CategoriaViewSet(viewsets.ReadOnlyModelViewSet):
    """ API endpoint para ver categorías y sus productos. """
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    permission_classes = [permissions.IsAuthenticated] # Cualquier usuario logueado puede ver


class ProductoViewSet(viewsets.ReadOnlyModelViewSet):
    """ API endpoint para ver productos. """
    queryset = Producto.objects.all()
    serializer_class = ProductoSerializer
    permission_classes = [permissions.IsAuthenticated] # Cualquier usuario logueado puede ver


class PedidoViewSet(viewsets.ModelViewSet):
    """
    API endpoint para gestionar Pedidos.
    Filtra por rol y usa serializers/permisos dinámicos.
    """
    # queryset dinámico
    def get_queryset(self):
        user = self.request.user
        # Todos ven solo pedidos no pagados, ordenados por fecha
        queryset = Pedido.objects.exclude(estado='pagado').order_by('fecha_hora')
        # Cocina solo ve pedidos que tengan items de su estación
        if user.groups.filter(name='Cocina').exists():
            # Filtra por la relación inversa desde PedidoDetalle
            return queryset.filter(detalles__producto__categoria__estacion='cocina').distinct()
        # Meseros y Admins ven todos los pedidos activos
        return queryset

    # serializer dinámico
    def get_serializer_class(self):
        if self.action == 'create':
            return PedidoCreateSerializer
        # Usamos PedidoUpdateSerializer para actualizar estado ('pagado')
        if self.action in ['update', 'partial_update']:
            return PedidoUpdateSerializer
        # Para ver listas o detalles, usamos el serializer de lectura
        return PedidoReadSerializer

    # permisos dinámicos
    def get_permissions(self):
        if self.action == 'create':
            permission_classes = [IsMeseroUser]
        # Cocina o Mesero pueden actualizar (ej: marcar como pagado)
        elif self.action in ['update', 'partial_update']:
            permission_classes = [IsCocinaUser | IsMeseroUser]
        # Ambos pueden ver listas y detalles
        else:
            permission_classes = [IsMeseroUser | IsCocinaUser]
        # Instancia las clases de permiso
        return [permission() for permission in permission_classes]


class PedidoDetalleViewSet(mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """
    API endpoint para actualizar el estado de un ÍTEM de pedido individual.
    ¡AHORA TAMBIÉN ENVÍA EVENTOS SSE!
    """
    queryset = PedidoDetalle.objects.all()
    serializer_class = PedidoDetalleUpdateSerializer
    # Cocina actualiza a preparacion/listo, Mesero actualiza a entregado
    permission_classes = [IsCocinaUser | IsMeseroUser]

    # --- ¡LÓGICA SSE AÑADIDA! ---
    # Sobrescribimos perform_update para enviar el evento DESPUÉS de guardar
    def perform_update(self, serializer):
        instance = serializer.save() # Guarda el cambio (ej: estado='listo')
        print(f"Estado de detalle {instance.id} actualizado a: {instance.estado}")

        try:
            # Si el nuevo estado es 'listo' (marcado por cocina)...
            if instance.estado == 'listo':
                # Enviamos evento al canal de la mesa específica
                channel_name = f"mesa-{instance.pedido.mesa.id}"
                print(f"Enviando evento SSE a canal '{channel_name}': item_listo")
                send_event(
                    channel_name, # Canal (ej: "mesa-5")
                    'item_listo', # Tipo de evento
                    { # Datos que enviamos al frontend (Mesa.jsx)
                        'detalle_id': instance.id,
                        'producto_nombre': instance.producto.nombre,
                        'mesa_numero': instance.pedido.mesa.numero,
                        'nuevo_estado': instance.estado
                    }
                )
            # Si el nuevo estado es 'entregado' (marcado por mesero)...
            elif instance.estado == 'entregado':
                 # Avisamos al canal de 'cocina' para que pueda limpiar su vista
                 print(f"Enviando evento SSE a canal 'cocina': item_entregado")
                 send_event(
                     'cocina', # Canal general de cocina
                     'item_entregado',
                      {'detalle_id': instance.id} # Solo necesitamos el ID
                 )
        except ImportError:
            # Si django_eventstream no está instalado, solo imprime advertencia
            print("WARN: django_eventstream no instalado, no se enviarán eventos SSE.")
        except Exception as e:
            # Captura cualquier otro error al enviar el evento
            print(f"ERROR: No se pudo enviar el evento SSE: {e}")
        # ----------------------------


# --- VISTA PARA /api/users/me/ ---
class CurrentUserView(APIView):
    """ Devuelve datos del usuario actualmente autenticado. """
    permission_classes = [IsAuthenticated] # Requiere token válido

    def get(self, request):
        serializer = UserSerializer(request.user) # Usa el UserSerializer
        return Response(serializer.data)


# --- VISTAS PERSONALIZADAS PARA LOGIN CON VERIFICACIÓN DE TURNO ---
# (Estas clases ahora están al nivel correcto, fuera de PedidoDetalleViewSet)

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """ Serializer de login que añade la verificación de turno. """
    def validate(self, attrs):
        data = super().validate(attrs) # Valida credenciales
        user = self.user # Usuario autenticado
        # Verifica turno solo si NO es Gerente o Superuser
        if not user.is_superuser and not user.groups.filter(name='Gerente').exists():
            if not Turno.objects.filter(estado='abierto').exists():
                raise PermissionDenied("No hay un turno abierto. El Gerente debe iniciar uno.")
        return data # Devuelve tokens si todo OK

class CustomTokenObtainPairView(TokenObtainPairView):
    """ Vista de login que usa el serializer con verificación de turno. """
    # Le decimos a la vista que use nuestro serializer personalizado
    serializer_class = CustomTokenObtainPairSerializer