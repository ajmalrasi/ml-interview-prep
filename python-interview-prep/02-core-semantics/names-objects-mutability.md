# Names, Objects and Mutability

## Assignment binds a name

```python
x = [10, 20]
y = x
```

There is one list and two names. You can verify the identity:

```python
print(x is y)  # True
```

Mutating the list through either name is visible through both:

```python
y.append(30)
print(x)  # [10, 20, 30]
```

## Rebinding is different

```python
y = [99]
```

This changes what `y` refers to. It does not modify the old list and does not affect `x`.

## Mutable and immutable objects

Common immutable types include integers, floats, booleans, strings, bytes, tuples, and frozensets. Lists, dictionaries, sets, and most user objects are mutable.

“Immutable” means the object cannot change after creation. An operation produces another object:

```python
name = "ada"
old_id = id(name)
name = name.title()
print(name)              # Ada
print(id(name) == old_id)  # False
```

## Augmented assignment depends on the type

```python
a = [1, 2]
b = a
a += [3]
print(a is b, b)  # True [1, 2, 3]
```

Lists implement in-place addition, so `+=` mutates when possible.

```python
a = (1, 2)
b = a
a += (3,)
print(a is b, b)  # False (1, 2)
```

Tuples cannot mutate, so a new tuple is created and `a` is rebound.

## Python's argument model: call by sharing

Function parameters become new local names bound to the passed objects:

```python
def change(items):
    items.append("visible")   # mutates caller's object
    items = ["local"]         # rebinds only local name

data = []
change(data)
print(data)  # ['visible']
```

## Interview answer

> Python passes object references by assignment, sometimes called call by sharing. A function can mutate a passed mutable object, but rebinding its local parameter does not rebind the caller's name.
