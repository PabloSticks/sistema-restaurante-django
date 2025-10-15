from rest_framework import viewsets, permissions, mixins # <-- ¡AÑADIMOS MIXINS!
from rest_framework.decorators import action
from rest_framework.response import Response
from decimal import Decimal

# Modelos
from .models import Mesa, Categoria, Producto, Pedido, PedidoDetalle

# Serializers
from .serializers import (
    MesaWithPedidosSerializer, 
    CategoriaSerializer, 
    ProductoSerializer, 
    PedidoReadSerializer,
    PedidoCreateSerializer, 
    PedidoUpdateSerializer,
    PedidoDetalleUpdateSerializer
)

# Permisos
from .permissions import IsMeseroUser, IsCocinaUser


class MesaViewSet(viewsets.ModelViewSet):
    queryset = Mesa.objects.all()
    serializer_class = MesaWithPedidosSerializer 
    permission_classes = [IsMeseroUser]

    @action(detail=True, methods=['get'])
    def calcular_total(self, request, pk=None):
        mesa = self.get_object()
        total = Decimal('0.00')
        pedidos_a_cobrar = mesa.pedidos.exclude(estado='pagado')
        for pedido in pedidos_a_cobrar:
            for detalle in pedido.detalles.all():
                if detalle.estado != 'entregado':
                    return Response(
                        {'error': 'No se puede cobrar, aún hay items pendientes de entrega.'},
                        status=400
                    )
        for pedido in pedidos_a_cobrar:
            for detalle in pedido.detalles.all():
                total += detalle.precio_unitario * detalle.cantidad
        return Response({'total': total})


class CategoriaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    permission_classes = [permissions.IsAuthenticated]


class ProductoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Producto.objects.all()
    serializer_class = ProductoSerializer
    permission_classes = [permissions.IsAuthenticated]


class PedidoViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        user = self.request.user
        queryset = Pedido.objects.exclude(estado='pagado').order_by('fecha_hora')
        if user.groups.filter(name='Cocina').exists():
            return queryset.filter(detalles__producto__categoria__estacion='cocina').distinct()
        return queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return PedidoCreateSerializer
        if self.action in ['update', 'partial_update']:
            return PedidoUpdateSerializer
        return PedidoReadSerializer

    def get_permissions(self):
        """Asigna permisos basados en la acción."""
        if self.action == 'create':
            permission_classes = [IsMeseroUser]
       
        elif self.action in ['update', 'partial_update']:
         
            permission_classes = [IsCocinaUser | IsMeseroUser]
        
        else:
            permission_classes = [IsMeseroUser | IsCocinaUser]
        return [permission() for permission in permission_classes]

class PedidoDetalleViewSet(mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """
    Permite a la cocina (o a un mesero) actualizar el estado de un ítem de pedido.
    """
    queryset = PedidoDetalle.objects.all()
    serializer_class = PedidoDetalleUpdateSerializer
    permission_classes = [IsCocinaUser | IsMeseroUser]