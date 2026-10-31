import io
p = r"C:/Users/admin/WorkBuddy/2026-10-24-22-23-14/mv/src/timeline.js"
s = io.open(p, encoding="utf-8").read()
reps = [
("id: 's06', factory: 'shotStation', t0: 19.10, t1: 24.30,\n    opts: { figures: 2, lamps: true }",
 "id: 's06', factory: 'shotStation', t0: 19.10, t1: 24.30,\n    opts: { figures: 2, lamps: true, variant: 0 }"),
("id: 's08', factory: 'shotStation', t0: 28.10, t1: 33.20,\n    opts: { figures: 1, lamps: true }",
 "id: 's08', factory: 'shotStation', t0: 28.10, t1: 33.20,\n    opts: { figures: 1, lamps: true, variant: 1 }"),
("id: 's10', factory: 'shotStation', t0: 38.30, t1: 43.10,\n    opts: { figures: 2, lamps: false }",
 "id: 's10', factory: 'shotStation', t0: 38.30, t1: 43.10,\n    opts: { figures: 2, lamps: false, variant: 3 }"),
("id: 's15', factory: 'shotStation', t0: 66.30, t1: 73.10,\n    opts: { figures: 2, lamps: true }",
 "id: 's15', factory: 'shotStation', t0: 66.30, t1: 73.10,\n    opts: { figures: 2, lamps: true, variant: 2 }"),
("id: 's23', factory: 'shotStation', t0: 118.40, t1: 124.40, opts: { figures: 2, lamps: true }",
 "id: 's23', factory: 'shotStation', t0: 118.40, t1: 124.40, opts: { figures: 2, lamps: true, variant: 1 }"),
("id: 's34', factory: 'shotStation', t0: 190.10, t1: 196.90, opts: { figures: 2, lamps: true }",
 "id: 's34', factory: 'shotStation', t0: 190.10, t1: 196.90, opts: { figures: 2, lamps: true, variant: 0 }"),
("id: 's37', factory: 'shotStation', t0: 209.60, t1: 213.20, opts: { figures: 1, lamps: false }",
 "id: 's37', factory: 'shotStation', t0: 209.60, t1: 213.20, opts: { figures: 1, lamps: false, variant: 3 }"),
]
for a, b in reps:
    assert a in s, "MISS " + a[:60]
    s = s.replace(a, b, 1)
io.open(p, "w", encoding="utf-8").write(s)
print("timeline ok")
