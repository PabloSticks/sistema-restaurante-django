from rest_framework import serializers
# Asegúrate de importar TokenObtainPairSerializer aquí
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.models import User # Necesario para UserSerializer y MyToken...
from django.db import transaction
# Importa TODOS tus modelos
from .models import Mesa, Categoria, Producto, Pedido, PedidoDetalle
# Importa la función para enviar eventos SSE
from django_eventstream import send_event

# --- SERIALIZER PARA DATOS DEL USUARIO (para /api/users/me/) ---
class UserSerializer(serializers.ModelSerializer):
    groups = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'groups', 'is_superuser']
        read_only_fields = fields

    def get_groups(self, obj):
        return list(obj.groups.values_list('name', flat=True))

# --- SERIALIZER PARA EL MENÚ (PRODUCTOS Y CATEGORÍAS) ---
class ProductoSerializer(serializers.ModelSerializer):
    categoria = serializers.StringRelatedField()
    estacion = serializers.CharField(source='categoria.estacion', read_only=True)

    class Meta:
        model = Producto
        fields = ['id', 'nombre', 'descripcion', 'precio', 'categoria', 'disponible', 'estacion']

class CategoriaSerializer(serializers.ModelSerializer):
    productos = ProductoSerializer(many=True, read_only=True)

    class Meta:
        model = Categoria
        fields = ['id', 'nombre', 'productos']

# --- SERIALIZERS PARA LEER PEDIDOS Y SUS DETALLES ---
class PedidoDetalleReadSerializer(serializers.ModelSerializer):
    producto = ProductoSerializer(read_only=True)

    class Meta:
        model = PedidoDetalle
        fields = ['id', 'producto', 'cantidad', 'nota', 'precio_unitario', 'estado']

class PedidoReadSerializer(serializers.ModelSerializer):
    detalles = PedidoDetalleReadSerializer(many=True, read_only=True)
    mesa = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Pedido
        fields = ['id', 'mesa', 'fecha_hora', 'estado', 'detalles']

# --- SERIALIZER PARA LEER MESAS (INCLUYENDO SUS PEDIDOS) ---
class MesaWithPedidosSerializer(serializers.ModelSerializer):
    pedidos = PedidoReadSerializer(many=True, read_only=True)

    class Meta:
        model = Mesa
        fields = ['id', 'numero', 'estado', 'pedidos']

# --- SERIALIZERS PARA ESCRIBIR/CREAR PEDIDOS ---
class PedidoDetalleWriteSerializer(serializers.ModelSerializer):
    producto = serializers.PrimaryKeyRelatedField(queryset=Producto.objects.all())

    class Meta:
        model = PedidoDetalle
        fields = ['producto', 'cantidad', 'nota']

class PedidoCreateSerializer(serializers.ModelSerializer):
    detalles = PedidoDetalleWriteSerializer(many=True)
    mesa = serializers.PrimaryKeyRelatedField(queryset=Mesa.objects.all())

    class Meta:
        model = Pedido
        fields = ['mesa', 'detalles']

    def create(self, validated_data):
        with transaction.atomic():
            detalles_data = validated_data.pop('detalles')
            mesa = validated_data.pop('mesa')
            pedido = Pedido.objects.create(mesa=mesa)

            if mesa.estado == 'disponible':
                mesa.estado = 'ocupada'
                mesa.save()

            for detalle_data in detalles_data:
                producto = detalle_data['producto']
                
                # --- ¡AQUÍ ESTÁ LA CORRECCIÓN! ---
                # 1. Asigna el objeto creado a la variable 'detalle'
                detalle = PedidoDetalle.objects.create(
                    pedido=pedido,
                    producto=producto,
                    cantidad=detalle_data['cantidad'],
                    nota=detalle_data.get('nota', ''),
                    precio_unitario=producto.precio
                    # El estado por defecto ('recibido') se aplica desde el modelo
                )

                # 2. Ahora sí puedes usar 'detalle.id' y 'detalle.estado'
                if producto.categoria.estacion == 'cocina':
                    print(f"Enviando evento SSE: nuevo_item_cocina para detalle {detalle.id}")
                    send_event(
                        'cocina',       # Nombre del canal
                        'nuevo_item',   # Tipo de evento
                        {               # Datos que enviamos
                            'detalle_id': detalle.id,
                            'producto_nombre': producto.nombre,
                            'cantidad': detalle.cantidad,
                            'mesa_numero': mesa.numero,
                            'pedido_id': pedido.id,
                            'estado': detalle.estado # Ahora sí tiene el estado 'recibido'
                        }
                    )
                # ---------------------------------
            return pedido

# --- SERIALIZERS PARA ACTUALIZAR ESTADOS ---
class PedidoUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pedido
        fields = ['estado']

class PedidoDetalleUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PedidoDetalle
        fields = ['estado']

# --- SERIALIZER PERSONALIZADO PARA LOGIN (JWT CON GRUPOS) ---
class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        token['username'] = user.username
        groups_list = list(user.groups.values_list('name', flat=True))
        token['groups'] = groups_list
        token['is_superuser'] = user.is_superuser

        # Prints de depuración (puedes borrarlos después si todo funciona)
        print(f"--- Ejecutando MyTokenObtainPairSerializer ---")
        print(f"Usuario autenticado: {user.username}")
        print(f"Grupos obtenidos de la BD: {groups_list}")
        print(f"Payload final del token: {token}")
        print("------------------------------------------")

        return token