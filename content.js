// Destaques e linha de equipamentos conforme o catálogo AVANSI 2026.
(typeof window === 'undefined' ? globalThis : window).AVANSI_CONTENT = {
 // Vídeos usam sua duração real. O tempo provisório só serve de fallback.
 hero: {durationMs:10000, transitionMs:500, autoplay:true},
 equipment: [
  {
   id:'equipamento-01', title:'Enleirador de Cama AV1500',
   description:'Implemento de duas roscas dentadas para formar leiras de cama de aviário.',
   image:'assets/Enleirador AV1500/capa.webp.png',
   imageAlt:'Enleirador de Cama AV1500 apresentado em frente a um aviário.',
   hero:{video:'assets/Enleirador AV1500/hero.mp4.mp4', poster:'assets/Enleirador AV1500/poster.webp.png', objectPosition:'58% 50%', objectPositionMobile:'65% 50%'},
   gallery:[1,2,3,4].map(number=>({src:`assets/Enleirador AV1500/catalogo-0${number}.webp.png`,alt:`Enleirador de Cama AV1500, foto de catálogo ${number} de 4.`}))
  },
  {
   id:'equipamento-02', title:'Batedor de Cama Manual AV650',
   description:'Equipamento autopropelido para quebrar crostas e revolver a cama de aviário.',
   image:'assets/Batetor de Cama Manual AV650c/capa.webp.png',
   imageAlt:'Batedor de Cama Manual AV650 apresentado em frente a um aviário.',
   hero:{video:'assets/Batetor de Cama Manual AV650c/hero.mp4.mp4', poster:'assets/Batetor de Cama Manual AV650c/poster.webp.png', objectPosition:'55% 50%', objectPositionMobile:'55% 50%'},
   gallery:[1,2,3,4].map(number=>({src:`assets/Batetor de Cama Manual AV650c/catalogo-0${number}.webp.png`,alt:`Batedor de Cama Manual AV650, foto de catálogo ${number} de 4.`}))
  },
  {
   id:'equipamento-03', title:'Aradinho Motorizado',
   description:'Escarificador compacto para soltar a cama perto de muretas, pilares e linhas de água.',
   image:'assets/Aradinho Motorizado/capa.webp.png',
   imageAlt:'Aradinho Motorizado apresentado em frente a um aviário.',
   hero:{video:'assets/Aradinho Motorizado/hero.mp4.mp4?v=20261107', poster:'assets/Aradinho Motorizado/poster.webp.png?v=20261107', objectPosition:'50% 50%', objectPositionMobile:'58% 50%'},
   gallery:[1,2,3,4].map(number=>({src:`assets/Aradinho Motorizado/catalogo-0${number}.webp.png`,alt:`Aradinho Motorizado, foto de catálogo ${number} de 4.`}))
  }
 ],
 additionalEquipment: [
  {id:'espalha-cal-manual', title:'Espalha Cal Manual'},
  {id:'queimador-penas-manual', title:'Queimador de Penas Manual'},
  {id:'arado-escarificador-tratorizado', title:'Arado Escarificador Tratorizado'},
  {id:'enleirador-avs1500', title:'Enleirador de Cama AVS1500'},
  {id:'espalha-cal-av2000', title:'Espalha Cal Tratorizado AV2000'},
  {id:'queimador-penas-tratorizado', title:'Queimador de Penas Tratorizado'},
  {id:'batedor-av1200', title:'Batedor de Cama Tratorizado AV1200'},
  {id:'batedor-av1500', title:'Batedor de Cama Tratorizado AV1500'},
  {id:'ferri-agrobot', title:'Robô Mexedor de Cama Ferri Agrobot (Versão Controle)'}
 ],
 contact: {whatsapp:'5544997113947', additionalWhatsapp:'5544991283518'},
 stage:'local-catalog-review'
};
