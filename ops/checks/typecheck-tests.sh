#!/bin/sh
# Second type-check (tsconfig.tests.json). Errors in files listed in tsconfig.tests.json's exclude (the temporary
# lane A list) are tolerated even when another file imports them; any other error fails.
out=$(npx tsc -p tsconfig.tests.json --pretty false) && exit 0
listed=$(sed -n 's/^ *"\([^"]*\.test\.ts\)",\{0,1\}$/\1/p' tsconfig.tests.json)
bad=$(printf '%s\n' "$out" | grep -E '^[^ ].*\([0-9]+,[0-9]+\): error' | awk -v l="$listed" 'BEGIN{n=split(l,a,"\n");for(i=1;i<=n;i++)s[a[i]]=1} {f=$0;sub(/\(.*/,"",f); if(!(f in s)) print}')
[ -z "$bad" ] && { echo "type errors only in the temporary lane A list"; exit 0; }
printf '%s\n' "$bad"; exit 1
