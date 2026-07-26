# Vidéos de témoignage

Déposez ici les vidéos servies avec le site, puis référencez-les dans
`frontend/src/client/temoignages.js` :

```js
{ id: 'mme-kouassi', personne: 'Mme Kouassi', role: 'Parent d’élève',
  video: '/videos/mme-kouassi.mp4', poster: '/videos/mme-kouassi.jpg' }
```

Le chemin commence par `/videos/` : tout ce que contient `public/` est servi
à la racine du site.

`poster` est facultatif — c'est l'image affichée avant lecture. Sans elle, le
navigateur montre la première image de la vidéo.

## Ou bien : YouTube / Vimeo

Pas besoin de fichier ici. Renseignez l'URL **d'intégration** (celle du bouton
« Intégrer », pas celle de la barre d'adresse) :

```js
video: 'https://www.youtube.com/embed/XXXXXXXXXXX'
```

La page choisit seule entre `<video>` et `<iframe>`.
