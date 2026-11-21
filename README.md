# HIPOLITECH — Un loc. Un început. Un viitor.

Prototip web **demonstrativ**, creat pentru tema AI-Powered Business Challenge 2026. Site-ul nu procesează plăți și nu colectează date bancare.

## Fișiere
- `index.html` — landing page inspirată de macheta vizuală selectată.
- `styles.css` — design responsive cu font Sora.
- `script.js` — simulatorul în 3 pași, validare, share, meniu mobil.
- `model-financiar.html` și `finance.js` — model financiar cu ipoteze editabile, scenarii și export CSV.
- `assets/hero-campus.webp` — decupaj din macheta de design furnizată; **ilustrație conceptuală**, nu fotografie oficială a viitorului cămin.

## Utilizare
Deschide `index.html` într-un browser. Pentru testare locală cu server:
```bash
python -m http.server 8000
```
Apoi navighează la `http://localhost:8000`.

## Publicare pe GitHub Pages
1. Încarcă fișierele în rădăcina unui repository GitHub public.
2. Din repository: **Settings → Pages → Build and deployment → Deploy from a branch**.
3. Alege `main` și `/ (root)`, apoi salvează.
4. Accesează adresa publică afișată de GitHub Pages.

## Teste manuale
1. În simulator: selectează „Absolvent”, apoi 100 lei → afișează `0,04%` din ținta ipotetică de 250.000 lei.
2. Selectează „Reprezentant al unei companii”, apoi 10.000 lei → afișează `4%`.
3. Introdu o valoare negativă sau lasă suma goală → mesaj de eroare, fără rezultat.
4. În modelul financiar: datele inițiale produc 250.000 lei brut, 15.000 lei costuri și 235.000 lei net.
5. Testează pe un telefon sau în modul responsive al browserului: 320, 375, 390, 430, 768 și 1440 px.

## Note
- Valorile de 1.250.000 lei și 100.000.000 lei sunt estimări publicate de Fundație, conform fișei de concurs.
- Valorile de 250.000 lei, 15.000 lei și 6 luni sunt ipoteze de concurs.
- Logo-ul este o reinterpretare grafică stilizată, nu sigla oficială. Pentru uz instituțional înlocuiește-l cu fișierul oficial autorizat.
- În cazul în care fontul Google nu se încarcă, browserul folosește un font sans-serif de sistem.
- Sursa oficială: https://fundatia.upb.ro/proiecte-si-evenimente/un-loc-in-camin-poate-schimba-un-destin/
