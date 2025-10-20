from django.contrib import admin
from .models import Mesa, Categoria, Producto, Pedido, PedidoDetalle, Turno
from django.utils import timezone 

admin.site.register(Mesa)
admin.site.register(Producto)

@admin.register(Turno)
class TurnoAdmin(admin.ModelAdmin):
    list_display = ('id', 'fecha_inicio', 'fecha_fin', 'abierto_por', 'estado')
    list_filter = ('estado', 'abierto_por')
    readonly_fields = ('fecha_inicio',) # Hacemos fecha_inicio de solo lectura

    # Acción para cerrar turnos
    def cerrar_turnos(self, request, queryset):
        queryset.update(estado='cerrado', fecha_fin=timezone.now())
    cerrar_turnos.short_description = "Cerrar turnos seleccionados"
    actions = [cerrar_turnos]


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