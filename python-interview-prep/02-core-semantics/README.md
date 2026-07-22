# Core Python Semantics

Most surprising Python questions reduce to one fact:

> A variable is a **name bound to an object**. It is not a box that contains a value.

From this model come mutation, aliasing, `is` versus `==`, hashability, shallow copies, closure behaviour, and mutable-default bugs.

## What this chapter teaches

- Why assignment usually does not copy.
- Why mutation can be visible through several names.
- Why equal objects may be distinct objects.
- What dictionaries require from keys.
- When defaults and closure variables are evaluated.

## A prediction to begin

```python
a = [1, 2]
b = a
a.append(3)
print(b)
```

The output is `[1, 2, 3]`. Assignment bound `b` to the same list object; it did not create a second list.

Now compare:

```python
a = [1, 2]
b = a
a = a + [3]
print(b)
```

The output is `[1, 2]`. `a + [3]` created a new list and rebound `a`; the original object bound to `b` did not change.

That distinction—**mutate versus rebind**—is the centre of this chapter.

→ Continue with **[Names, Objects and Mutability](names-objects-mutability.md)**.
