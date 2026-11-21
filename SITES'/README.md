# HIPOLITECH — site actualizat

Site static pentru campania demonstrativă „Un cămin, un nou destin. La POLI, viitorul e senin.” Include simulatorul existent, sunet opțional pentru butoane, un design adaptat telefoanelor și monitorizare Supabase cu panou privat.

## Ce este inclus

- `index.html`, `model-financiar.html`, `styles.css`, `enhancements.css`, `script.js` — site-ul public. Steluța/emoji-ul decorativ a fost eliminat complet.
- `analytics-config.js` — singurul fișier de completat cu URL-ul proiectului și cheia **publică** Supabase. Monitorizarea este implicit dezactivată.
- `privacy.html` — nota de confidențialitate afișabilă vizitatorilor.
- `admin.html`, `admin.js` — panou privat: vizitatori activi în ultimele 5 minute, accesări azi/total și pagini populare; actualizare la 15 secunde.
- `supabase/migrations/20261121_analytics.sql` — tabele, RLS, funcții de limitare și agregare.
- `supabase/functions/collect-pageview` — colector public controlat de server.
- `supabase/functions/admin-analytics` — interfață privată pentru panou.

## Rulează local

Site-ul funcționează și fără Supabase; atunci statistica este oprită.

```powershell
python -m http.server 8000
```

Deschide `http://localhost:8000`. Pentru test complet al statisticii, include `http://localhost:8000` la `ANALYTICS_SITE_ORIGINS` înainte de a publica funcțiile.

## Configurare Supabase

### 1. Creează proiectul și structura securizată

1. Creează un proiect nou în Supabase.
2. În **SQL Editor**, deschide și rulează integral fișierul `supabase/migrations/20261121_analytics.sql`.
3. În **Authentication**, creează manual un utilizator pentru administrator și păstrează dezactivată înscrierea publică, dacă panoul este doar pentru echipă.
4. În SQL Editor, află ID-ul utilizatorului creat și declară-l administrator:

```sql
select id, email from auth.users;

insert into public.analytics_admins (user_id)
values ('LIPESTE-AICI-UUID-UL-ADMINULUI');
```

Înlocuiește UUID-ul cu cel din primul rezultat. Repetă doar a doua comandă pentru fiecare administrator nou.

### 2. Publică funcțiile Edge

Instalează Supabase CLI, conectează-l la proiect și rulează comenzile din rădăcina acestui site:

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set ANALYTICS_SITE_ORIGINS="https://NUME_UTILIZATOR.github.io,http://localhost:8000" ANALYTICS_HASH_SECRET="o-valoare-aleatoare-de-minim-32-caractere"
supabase functions deploy collect-pageview --no-verify-jwt
supabase functions deploy admin-analytics --no-verify-jwt
```

`ANALYTICS_SITE_ORIGINS` conține doar origini (protocol + domeniu), nu calea repository-ului. Pentru GitHub Pages, de exemplu, originea este `https://NUME_UTILIZATOR.github.io` chiar dacă site-ul este la `/nume-repository/`. Dacă folosești domeniu propriu, adaugă și acel domeniu după ce este activ.

Nu introduce niciodată în site cheia `service_role` sau o cheie `secret`. Ele sunt disponibile automat doar în funcțiile Edge. Variabilele reale nu se comit: `supabase/functions/.env` este ignorat de Git.

### 3. Activează codul public

În Supabase, copiază **Project URL** și cheia **Publishable** (sau cheia anonimă legacy). Editează `analytics-config.js`:

```js
window.HIPOLITECH_ANALYTICS = {
  enabled: true,
  supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
  publishableKey: 'CHEIA_PUBLICA_DIN_SUPABASE',
  collectorFunction: 'collect-pageview',
  adminFunction: 'admin-analytics'
};
```

Cheia publică poate fi în browser deoarece tabelele au RLS activ și rolurile `anon`/`authenticated` nu primesc acces direct la evenimente. Cheia secretă nu are ce căuta în acest fișier.

### 4. Verifică

1. Vizitează `index.html` sau `model-financiar.html` publicat.
2. Intră la `admin.html`, autentifică-te cu contul creat la pasul 1 și verifică valorile.
3. Dacă apare „Nu ai drept de administrator”, confirmă că UUID-ul din `analytics_admins` este al contului cu care te-ai autentificat.
4. În SQL Editor, poți curăța manual datele vechi cu:

```sql
select public.purge_analytics_data();
```

Pentru păstrarea automată a retenției de 90 de zile, programează această comandă în instrumentul de programări al proiectului sau într-un job administrativ controlat de echipă.

## Ce protecții sunt active

- Nu se trimit din browser IP-ul, agentul browserului, refererul sau parametrii URL; serverul păstrează numai ruta și un hash pseudonimizat, schimbat zilnic.
- Nu sunt folosite cookie-uri de analiză. `sessionStorage` este folosit numai pentru a evita o a doua trimitere în 30 de secunde pe aceeași pagină.
- Evenimentele brute nu pot fi citite ori scrise direct de vizitatori: RLS este activ, fără politici pentru rolurile publice.
- Funcția publică acceptă numai originile declarate, validează strict payload-ul, are câmp capcană și limite de 12 evenimente/minut și 200/zi per rețea pseudonimizată.
- Panoul cere autentificare Supabase și verifică lista `analytics_admins` exclusiv pe server; el returnează doar totaluri, nu identificatori de vizitatori.
- Datele evenimentelor sunt retenționate maximum 90 de zile; datele de limitare maximum 2 zile.

Limitarea reduce traficul automat obișnuit, dar nu poate opri complet atacuri distribuite. Pentru trafic mare, pune site-ul în spatele unui CDN/WAF și activează regulile anti-bot ale furnizorului.

## Publicare pe GitHub Pages

1. Urcă toate fișierele din această arhivă în rădăcina repository-ului GitHub, inclusiv folderele `assets` și `supabase`.
2. În repository intră la **Settings → Pages**.
3. La **Build and deployment**, alege **Deploy from a branch**.
4. Alege ramura `main` și folderul `/(root)`, apoi apasă **Save**.
5. După ce GitHub afișează adresa, adaugă originea ei la secretul `ANALYTICS_SITE_ORIGINS` și actualizează secretul cu `supabase secrets set`.
6. Dacă folosești domeniu propriu, configurează-l din Pages și activează **Enforce HTTPS** înainte să îl adaugi în lista de origini.

## Teste recomandate

- Verifică la 320, 375, 390, 430, 768 și 1440 px; sloganul se rupe pe rânduri, fără element decorativ verde.
- Atinge un buton pe telefon: se aude un „cha-ching” scurt; butonul cu nota muzicală îl poate opri.
- Cu monitorizarea configurată, reîncarcă site-ul, apoi verifică o creștere în `admin.html` în maximum 15 secunde.
- Confirmă că `analytics-config.js` nu conține o cheie secretă și că `.env`/`supabase/functions/.env` nu apar în commit.
