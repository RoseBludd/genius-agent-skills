import sqlite3
db=sqlite3.connect("/app/backend/data/webui.db")
db.row_factory=sqlite3.Row
c=db.cursor()
c.execute("SELECT key,value FROM config")
for r in c.fetchall():
    k=r["key"].lower()
    if ("enable" in k and ("search" in k or "tool" in k or "rag" in k)) or k in ("web.search.engine","web.search.enabled","web.search.engine.to.use","tool.enabled","features.enable_web_search","ui.enable_web_search"):
        v=r["value"]
        if isinstance(v,bytes): v=v.decode(errors="replace")
        print(k,"=",str(v)[:120])
