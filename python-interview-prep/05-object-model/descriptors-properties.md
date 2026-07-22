# Descriptors and Properties

A descriptor is an object on a class that defines attribute-access hooks such as `__get__`, `__set__`, or `__delete__`.

Functions, `property`, `classmethod`, `staticmethod`, and many ORM fields use this protocol.

## A validating descriptor

```python
class Positive:
    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, obj, owner=None):
        if obj is None:
            return self
        return obj.__dict__[self.name]

    def __set__(self, obj, value):
        if value <= 0:
            raise ValueError("must be positive")
        obj.__dict__[self.name] = value

class Product:
    price = Positive()
```

The reusable descriptor controls `product.price` for every `Product` instance.

## Data versus non-data descriptors

- A **data descriptor** defines `__set__` or `__delete__`; it wins over the instance dictionary.
- A **non-data descriptor** defines only `__get__`; an instance attribute can shadow it.

Normal functions are non-data descriptors, which is why assigning `obj.method = something` can shadow the class method for that instance.

## Property is the common case

```python
class Circle:
    def __init__(self, radius):
        self.radius = radius

    @property
    def area(self):
        return 3.14159 * self.radius ** 2
```

`circle.area` looks like data while remaining computed. Add a setter only when assignment has a clear meaning.

## Simplified lookup order

1. custom `__getattribute__` machinery;
2. data descriptor on the class/MRO;
3. instance `__dict__`;
4. non-data descriptor or class attribute;
5. `__getattr__` if the name is still missing.

## Interview answer

> A descriptor is a class attribute that controls attribute access through `__get__`, `__set__`, or `__delete__`. Data descriptors beat instance attributes; non-data descriptors can be shadowed. Methods and properties are built on this protocol.
