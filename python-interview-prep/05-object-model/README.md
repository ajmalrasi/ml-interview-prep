# The Python Object Model

Python syntax such as `obj.method()`, `@property`, and `super()` is powered by protocols. Understanding those protocols turns advanced questions into predictable lookup rules.

This chapter teaches:

- how classes create instances;
- how the method resolution order handles multiple inheritance;
- why functions become bound methods;
- how descriptors power properties and managed fields;
- what dataclasses and `__slots__` actually generate or change.

## Creation versus initialisation

```python
obj = MyClass(arg)
```

Conceptually, the metaclass calls `MyClass.__new__` to create an instance and then `__init__` to initialise it. `__init__` does not return the instance; it must return `None`.

Immutable subclasses sometimes customise `__new__` because their value must be fixed during creation.

→ Continue with **[Classes, MRO and super](classes-mro-super.md)**.
