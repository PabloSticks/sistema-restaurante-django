from django.utils import timezone
from django.db import models
from django.contrib.auth.models import User

class Mesa(models.Model):
    ESTADO_CHOICES = [
        ('disponible', 'Disponible'),
        ('ocupada', 'Ocupada'),
        ('pagando', 'Pagando'),
    ]

    numero = models.IntegerField(unique=True, verbose_name="Número de Mesa")
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='disponible', verbose_name="Estado")

    def __str__(self):
        return f"Mesa #{self.numero} - {self.get_estado_display()}"

    class Meta:
        verbose_name = "Mesa"
        verbose_name_plural = "Mesas"
        ordering = ['numero']

class Categoria(models.Model):
    STATION_CHOICES = [
        ('cocina', 'Cocina'),
        ('bar', 'Bar/Mesero'),
    ]
    nombre = models.CharField(max_length=100, unique=True, verbose_name="Nombre")

    estacion = models.CharField(max_length=20, choices=STATION_CHOICES, default='cocina', verbose_name="Estación de Preparación")

    def __str__(self):
        return self.nombre

    class Meta:
        verbose_name = "Categoría"
        verbose_name_plural = "Categorías"

class Producto(models.Model):
    nombre = models.CharField(max_length=100, verbose_name="Nombre")
    descripcion = models.TextField(blank=True, verbose_name="Descripción")
    precio = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Precio")
    categoria = models.ForeignKey(Categoria, related_name='productos', on_delete=models.CASCADE, verbose_name="Categoría")
    disponible = models.BooleanField(default=True, verbose_name="¿Está disponible?")

    def __str__(self):
        return f"{self.nombre} - ${self.precio}"

    class Meta:
        verbose_name = "Producto"
        verbose_name_plural = "Productos"

class Pedido(models.Model):
    ESTADO_CHOICES = [
        ('recibido', 'Recibido'),
        ('preparacion', 'En Preparación'),
        ('listo', 'Listo para Servir'),
        ('entregado', 'Entregado'),
        ('pagado', 'Pagado'),
    ]

    mesa = models.ForeignKey(Mesa, related_name='pedidos', on_delete=models.CASCADE, verbose_name="Mesa")
    fecha_hora = models.DateTimeField(auto_now_add=True, verbose_name="Fecha y Hora")
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='recibido', verbose_name="Estado del Pedido")
 

    def __str__(self):
        return f"Pedido #{self.id} en {self.mesa} - {self.get_estado_display()}"

    class Meta:
        verbose_name = "Pedido"
        verbose_name_plural = "Pedidos"
        ordering = ['-fecha_hora']

class PedidoDetalle(models.Model):
   
    ESTADO_CHOICES = [
        ('recibido', 'Recibido'),
        ('preparacion', 'En Preparación'),
        ('listo', 'Listo para Servir'),
        ('entregado', 'Entregado'),
    ]

    pedido = models.ForeignKey(Pedido, related_name='detalles', on_delete=models.CASCADE, verbose_name="Pedido")
    producto = models.ForeignKey(Producto, related_name='detalles_pedido', on_delete=models.CASCADE, verbose_name="Producto")
    cantidad = models.PositiveIntegerField(verbose_name="Cantidad")
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Precio Unitario")
    nota = models.TextField(blank=True, verbose_name="Nota Adicional")
   
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='recibido', verbose_name="Estado del Detalle")

    def __str__(self):
        return f"{self.cantidad}x {self.producto.nombre} en Pedido #{self.pedido.id}"

    class Meta:
        verbose_name = "Detalle de Pedido"
        verbose_name_plural = "Detalles de Pedidos"

class Turno(models.Model):
    ESTADO_CHOICES = [
        ('abierto', 'Abierto'),
        ('cerrado', 'Cerrado'),
    ]

    fecha_inicio = models.DateTimeField(default=timezone.now, verbose_name="Fecha y Hora de Inicio")
    fecha_fin = models.DateTimeField(null=True, blank=True, verbose_name="Fecha y Hora de Fin")
    abierto_por = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='turnos_abiertos',
        verbose_name="Abierto por (Gerente)",
        limit_choices_to={'groups__name': 'Gerente'}
    )
    estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='abierto', verbose_name="Estado")

    def __str__(self):
        inicio_fmt = self.fecha_inicio.strftime('%d/%m/%Y %H:%M')
        fin_str = f" - Fin: {self.fecha_fin.strftime('%d/%m/%Y %H:%M')}" if self.fecha_fin else ""
        return f"Turno {self.id} ({self.estado}) | Inicio: {inicio_fmt}{fin_str} | Por: {self.abierto_por.username}"

    class Meta:
        verbose_name = "Turno"
        verbose_name_plural = "Turnos"
        ordering = ['-fecha_inicio']