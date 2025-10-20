from django.urls import path, include
from rest_framework.routers import DefaultRouter
# Importa todas las vistas necesarias, incluyendo CurrentUserView
from .views import (
    MesaViewSet,
    CategoriaViewSet,
    ProductoViewSet,
    PedidoViewSet,
    PedidoDetalleViewSet,
    CurrentUserView # <-- CORRECTO
)

router = DefaultRouter()
# Registra todos los ViewSets con sus basenames
router.register(r'mesas', MesaViewSet, basename='mesa')
router.register(r'categorias', CategoriaViewSet, basename='categoria')
router.register(r'productos', ProductoViewSet, basename='producto')
router.register(r'pedidos', PedidoViewSet, basename='pedido')
router.register(r'detalles-pedido', PedidoDetalleViewSet, basename='detalle-pedido')

urlpatterns = [
    # Incluye las URLs generadas por el router
    path('', include(router.urls)),
    # Añade la URL personalizada para obtener el usuario actual
    path('users/me/', CurrentUserView.as_view(), name='current-user'), # <-- CORRECTO
]