from django.contrib import admin
from .models import Mesa, Categoria, Producto, Pedido, PedidoDetalle

# Registramos los modelos que no necesitan personalización especial
admin.site.register(Mesa)
admin.site.register(Producto)

# Usamos el decorador para personalizar la vista de Categoria
@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'estacion') 
    list_filter = ('estacion',)          

# Usamos el decorador para personalizar la vista de Pedido
@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    # Clase interna para mostrar los detalles del pedido de forma más limpia
    class PedidoDetalleInline(admin.TabularInline):
        model = PedidoDetalle
        extra = 0 

    list_display = ('id', 'mesa', 'fecha_hora', 'estado')
    list_filter = ('estado', 'mesa')
    inlines = [PedidoDetalleInline] 