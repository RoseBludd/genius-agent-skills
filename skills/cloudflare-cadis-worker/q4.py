import sqlite3
db=sqlite3.connect("/app/backend/data/webui.db")
db.row_factory=sqlite3.Row
c=db.cursor()
c.execute("SELECT key,value FROM config")
rows=c.fetchall()
hits=[r for r in rows if any(s in r["key"].lower() for s in ("web","search","tool","feature"))]
for r in hits:
    v=r["value"]
    if isinstance(v,bytes): v=v.decode(errors="replace")
    print(r["key"],"=",str(v)[:250])
print("total config rows:",len(rows))
