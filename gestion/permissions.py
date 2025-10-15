
from rest_framework.permissions import BasePermission

class IsMeseroUser(BasePermission):
    """
    Permite el acceso a superusuarios o a usuarios en el grupo 'Meseros'.
    """
    def has_permission(self, request, view):
        # Si el usuario es superuser, siempre tiene permiso
        if request.user.is_superuser:
            return True
        # Si no, verifica si pertenece al grupo 'Meseros'
        return request.user.groups.filter(name='Meseros').exists()

class IsCocinaUser(BasePermission):
    """
    Permite el acceso a superusuarios o a usuarios en el grupo 'Cocina'.
    """
    def has_permission(self, request, view):
        if request.user.is_superuser:
            return True
        return request.user.groups.filter(name='Cocina').exists()
    