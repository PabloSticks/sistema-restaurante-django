from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django_eventstream.urls import urlpatterns as stream_patterns

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('gestion.urls')),
    path('api-auth/', include('rest_framework.urls')),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # --- LOS EVENTOS SSE ---
    path('api/events/', include((stream_patterns, 'django_eventstream'), namespace='django_eventstream')),
    # -------------------------
]