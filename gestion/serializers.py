from rest_framework import serializers
from .models import Mesa, Categoria, Producto, Pedido, PedidoDetalle
from django.db import transaction

# --- SERIALIZERS GENERALES / DE LECTURA ---

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

# --- SERIALIZERS PARA LEER PEDIDOS ---

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

# --- SERIALIZER DE MESAS ---
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
                PedidoDetalle.objects.create(
                    pedido=pedido, producto=producto,
                    cantidad=detalle_data['cantidad'],
                    nota=detalle_data.get('nota', ''),
                    precio_unitario=producto.precio 
                )
            return pedido

# --- SERIALIZER PARA ACTUALIZAR ESTADO DE PEDIDO (COCINA) ---
class PedidoUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pedido
        fields = ['estado']
# --- SERIALIZER PARA ACTUALIZAR ESTADO DE DETALLE DE PEDIDO (COCINA) ---
class PedidoDetalleUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PedidoDetalle
        fields = ['estado']