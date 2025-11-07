---
name: django-model-helper
description: Generates Django models with proper field types, relationships, indexes, migrations, and admin configuration. Use when creating Django database models.
---

# Django Model Helper Skill

Expert at creating Django models following best practices with proper relationships, indexes, and migrations.

## When to Activate

- "create Django model for [entity]"
- "generate Django ORM model"
- "build Django database schema"

## Complete Model Structure

```python
# models/user.py
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinLengthValidator, EmailValidator
from django.utils import timezone

class User(AbstractUser):
    """Extended user model with additional fields"""

    # Additional Fields
    bio = models.TextField(blank=True, help_text="User biography")
    avatar = models.ImageField(
        upload_to='avatars/%Y/%m/',
        blank=True,
        null=True
    )
    phone = models.CharField(
        max_length=20,
        blank=True,
        validators=[MinLengthValidator(10)]
    )
    date_of_birth = models.DateField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Status
    is_verified = models.BooleanField(default=False)
    is_premium = models.BooleanField(default=False)

    class Meta:
        db_table = 'users'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['created_at']),
            models.Index(fields=['is_verified', 'is_premium']),
        ]
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return self.username

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.username

class Post(models.Model):
    """Blog post model"""

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PUBLISHED = 'published', 'Published'
        ARCHIVED = 'archived', 'Archived'

    # Fields
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True, max_length=200)
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='posts'
    )
    content = models.TextField()
    excerpt = models.TextField(max_length=500, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT
    )

    # Relationships
    categories = models.ManyToManyField(
        'Category',
        related_name='posts',
        blank=True
    )
    tags = models.ManyToManyField(
        'Tag',
        related_name='posts',
        blank=True
    )

    # Metadata
    views = models.PositiveIntegerField(default=0)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'posts'
        ordering = ['-published_at', '-created_at']
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['status', '-published_at']),
            models.Index(fields=['author', '-published_at']),
        ]
        verbose_name = 'Post'
        verbose_name_plural = 'Posts'

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        # Auto-set published_at when status changes to published
        if self.status == self.Status.PUBLISHED and not self.published_at:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)

    @property
    def is_published(self):
        return self.status == self.Status.PUBLISHED

# Admin Configuration
# admin.py
from django.contrib import admin
from .models import User, Post

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['username', 'email', 'is_verified', 'is_premium', 'created_at']
    list_filter = ['is_verified', 'is_premium', 'is_staff']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Account', {
            'fields': ('username', 'email', 'password')
        }),
        ('Personal Info', {
            'fields': ('first_name', 'last_name', 'bio', 'avatar', 'phone', 'date_of_birth')
        }),
        ('Status', {
            'fields': ('is_verified', 'is_premium', 'is_active', 'is_staff')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ['title', 'author', 'status', 'published_at', 'views']
    list_filter = ['status', 'created_at', 'published_at']
    search_fields = ['title', 'content']
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ['created_at', 'updated_at', 'views']
    filter_horizontal = ['categories', 'tags']
```

## Migration Commands

```bash
# Create migrations
python manage.py makemigrations

# Review migration SQL
python manage.py sqlmigrate app_name 0001

# Apply migrations
python manage.py migrate

# Create empty migration for data migration
python manage.py makemigrations --empty app_name
```

## Best Practices

- Use appropriate field types
- Add indexes for frequently queried fields
- Define __str__ methods
- Use Meta class for configuration
- Add related_name to relationships
- Include created_at/updated_at timestamps
- Use on_delete properly (CASCADE, PROTECT, SET_NULL)
- Add helpful docstrings
- Use choices for status fields
- Implement custom save methods when needed
- Add validators
- Configure admin interface

## Output Checklist

- ✅ Model created with proper fields
- ✅ Relationships defined
- ✅ Meta class configured
- ✅ Indexes added
- ✅ Admin configuration
- ✅ Migration ready
- 📝 Usage examples
