from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MesaViewSet, 
    CategoriaViewSet, 
    ProductoViewSet, 
    PedidoViewSet, 
    PedidoDetalleViewSet
)

router = DefaultRouter()
router.register(r'mesas', MesaViewSet, basename='mesa')
router.register(r'categorias', CategoriaViewSet, basename='categoria')
router.register(r'productos', ProductoViewSet, basename='producto')
router.register(r'pedidos', PedidoViewSet, basename='pedido')
router.register(r'detalles-pedido', PedidoDetalleViewSet, basename='detalle-pedido')

urlpatterns = [
    path('', include(router.urls)),
]