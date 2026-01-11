# Documents Folder

Place your `.txt` files here with the following structure:

## File Format

```
[Meta]
thinker: [Name of philosopher/thinker]
work: [Name of the work/book]
chapter: [Chapter name or section]

[Content]
First paragraph of philosophical text goes here.
This can span multiple lines.

---

Second paragraph goes here.
Another philosophical concept or argument.

---

Third paragraph...

---
```

## Example

```
[Meta]
thinker: אריסטו
work: פוליטיקה
chapter: ספר א

[Content]
כל מדינה היא סוג של קהילה, וכל קהילה מוקמת למען איזה טוב...

---

האדם הוא מטבעו חיה פוליטית, וזה שאינו חי במדינה, או משום שהוא משובח מאד או משום שהוא נחות מאד...

---
```

## Important Notes

- Use `[Meta]` and `[Content]` section markers (case insensitive)
- Separate paragraphs with `---` (three or more hyphens)
- `thinker` and `work` are required
- `chapter` is optional
- Save files with `.txt` extension
- Use UTF-8 encoding for Hebrew text
