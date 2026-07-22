# Classes, MRO and `super`

## Attribute lookup follows the MRO

Every class has a method resolution order:

```python
class A: ...
class B(A): ...
class C(A): ...
class D(B, C): ...

print(D.mro())
# [D, B, C, A, object]
```

Python uses C3 linearisation to preserve local base ordering and consistent ancestry.

## `super()` does not mean “my parent”

It means: continue lookup **after the class where this method was defined**, using the runtime instance's MRO.

```python
class A:
    def save(self):
        print("A")

class B(A):
    def save(self):
        print("B")
        super().save()

class C(A):
    def save(self):
        print("C")
        super().save()

class D(B, C):
    pass

D().save()  # B, C, A
```

Inside `B`, `super()` reaches `C` for a `D` instance—not directly `A`.

## Cooperative inheritance

For the chain to work, participating classes use compatible signatures and each calls `super()` exactly once. Hard-coding `A.save(self)` can skip a sibling or call a shared ancestor twice.

Mixins should usually be small, stateless, and cooperative.

## Bound methods

A function stored on a class is a descriptor. Reading it through an instance produces a bound method:

```python
obj.save.__self__ is obj
obj.save.__func__ is type(obj).save
```

That is how `self` is supplied automatically.

## Interview answer

> The MRO is the C3-linearised class lookup order. `super()` returns a proxy that continues lookup after the current defining class in that MRO, enabling cooperative multiple inheritance rather than simply calling a direct parent.
