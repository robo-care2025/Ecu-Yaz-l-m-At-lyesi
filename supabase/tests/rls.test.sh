#!/usr/bin/env bash
# Migration + seed'i geçici bir PostgreSQL'e uygular ve RLS kurallarını doğrular.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin | tail -1)}"
PORT="${PGPORT_TEST:-54329}"
TMP="$(mktemp -d)"
chmod 777 "$TMP"
RUN=(); [ "$(id -u)" = "0" ] && RUN=(runuser -u postgres --)

cleanup() { "${RUN[@]}" "$PGBIN/pg_ctl" -D "$TMP/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

"${RUN[@]}" "$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null

PSQL=(psql -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -qtA)
q() { "${PSQL[@]}" -c "$1"; }

"${PSQL[@]}" -f "$HERE/auth_stub.sql" >/dev/null
for f in "$ROOT"/migrations/*.sql "$ROOT"/seed/*.sql; do "${PSQL[@]}" -f "$f" >/dev/null; done

A_WS=11111111-1111-1111-1111-111111111111
B_WS=22222222-2222-2222-2222-222222222222
A_U=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
B_U=bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
q "insert into workshops(id,name,phone) values ('$A_WS','A','1'),('$B_WS','B','2');
   select seed_workshop('$A_WS'); select seed_workshop('$B_WS');
   insert into auth.users values ('$A_U'),('$B_U');
   insert into profiles values ('$A_U','$A_WS'),('$B_U','$B_WS');
   insert into jobs(workshop_id,status,raw_text) values ('$A_WS','yeni','a'),('$B_WS','yeni','b');
   insert into error_codes(workshop_id,brand,code,meaning,causes,source) values (null,'Xiaomi','E10','test','{}','test');" >/dev/null

as() { "${PSQL[@]}" -c "set role authenticated; set request.jwt.claim.sub = '$1'; $2"; }
fail() { echo "BAŞARISIZ: $1"; exit 1; }

[ "$(as $A_U 'select count(*) from jobs')" = "1" ] || fail "A sadece kendi işini görmeli"
[ "$(as $A_U "select raw_text from jobs")" = "a" ] || fail "A'nın gördüğü iş A'nın olmalı"
if as $A_U "insert into jobs(workshop_id,status,raw_text) values ('$B_WS','yeni','x')" >/dev/null 2>&1; then
  fail "A, B adına iş ekleyememeli"; fi
[ "$(as $A_U 'select name from brand_groups order by sort limit 1')" = "Ducati" ] || fail "İlk grup Ducati olmalı"
[ "$(as $A_U 'select name from brands order by sort limit 1')" = "Ducati" ] || fail "İlk marka Ducati olmalı"
[ "$(as $A_U 'select count(*) from error_codes')" = "1" ] || fail "Ortak hata kodu A'ya görünmeli"
[ "$(as $B_U 'select count(*) from error_codes')" = "1" ] || fail "Ortak hata kodu B'ye görünmeli"
[ "$(as $A_U "select count(*) from price_items")" -ge "10" ] || fail "Örnek fiyatlar yüklenmeli"
if as $A_U "insert into price_items(workshop_id,item_name,group_id,min_tl,max_tl,duration)
  select '$A_WS','x',id,500,100,'1 gün' from brand_groups limit 1" >/dev/null 2>&1; then
  fail "min_tl > max_tl reddedilmeli"; fi
[ "$(q "select name from workshops where name='E-Scooter Tamir Merkezi'")" = "E-Scooter Tamir Merkezi" ] || fail "Varsayılan atölye yok"
echo "RLS OK"
