'use strict';
const nav=document.querySelector('#navigation');
const toggle=document.querySelector('.menu-toggle');
const closeMenu=(restoreFocus=false)=>{
 const wasOpen=toggle.getAttribute('aria-expanded')==='true';
 toggle.setAttribute('aria-expanded','false');nav.classList.remove('is-open');
 if(wasOpen&&restoreFocus)toggle.focus();
};
toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));nav.classList.toggle('is-open',open);});
nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>closeMenu()));
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu(true);});
document.addEventListener('click',event=>{if(!event.target.closest('.header'))closeMenu();});
document.addEventListener('focusin',event=>{if(!event.target.closest('.header'))closeMenu();});
window.matchMedia('(max-width: 1000px)').addEventListener('change',()=>closeMenu());
const dialog=document.querySelector('#equipment-dialog');
const grid=document.querySelector('#equipment-grid');
const gallery = dialog.querySelector('.product-gallery');
const galleryImage = dialog.querySelector('#gallery-image');
const galleryView = dialog.querySelector('.gallery-view');
const thumbnails = dialog.querySelector('.gallery-thumbnails');
const galleryCount = dialog.querySelector('#gallery-count');
const {equipment, additionalEquipment, contact}=window.AVANSI_CONTENT;
const products=[...equipment,...additionalEquipment];
const interest=document.querySelector('#equipment-interest');
const whatsappLinks=document.querySelectorAll('[data-whatsapp]');
let galleryItem = null;
let galleryIndex = 0;
let dialogOpener = null;
let restoreDialogFocus = true;
let swipeStart = null;

function updateCommercialLinks(){
 const product=products.find(item=>item.id===interest.value);
 const message=product
  ? `Olá! Gostaria de informações sobre: ${product.title}.`
  : 'Olá! Gostaria de informações sobre os equipamentos AVANSI.';
 const url=`https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(message)}`;
 whatsappLinks.forEach(link=>{link.href=url;});
}

function selectInterest(id){
 interest.value=id;
 updateCommercialLinks();
}

for(const item of products){
 const option=document.createElement('option');
 option.value=item.id;
 option.textContent=item.title;
 interest.append(option);
}
const catalogLine=document.querySelector('#catalog-equipment');
for(const item of additionalEquipment){
 const entry=document.createElement('li');
 const link=document.createElement('a');
 link.href='#contato';
 link.dataset.interest=item.id;
 link.textContent=item.title;
 entry.append(link);
 catalogLine.append(entry);
}
document.querySelectorAll('[data-interest]').forEach(link=>{
 link.addEventListener('click',()=>selectInterest(link.dataset.interest));
});
interest.addEventListener('change',updateCommercialLinks);
window.addEventListener('pageshow',updateCommercialLinks);
updateCommercialLinks();

function showGalleryImage(nextIndex, focusThumbnail = false){
 const photos=galleryItem?.gallery || [];
 if(!photos.length)return;
 galleryIndex=(nextIndex+photos.length)%photos.length;
 const photo=photos[galleryIndex];
 galleryImage.src=photo.src;
 galleryImage.alt=photo.alt;
 galleryCount.textContent=`Foto ${galleryIndex+1} de ${photos.length}`;
 galleryView.setAttribute('aria-label',`${galleryItem.title}, foto ${galleryIndex+1} de ${photos.length}`);
 const buttons=[...thumbnails.querySelectorAll('button')];
 buttons.forEach((button,index)=>{
  button.setAttribute('aria-pressed',String(index===galleryIndex));
  button.tabIndex=index===galleryIndex?0:-1;
 });
 if(focusThumbnail)buttons[galleryIndex]?.focus();
}

function openEquipmentDialog(item){
 dialogOpener=document.activeElement;
 restoreDialogFocus=true;
 galleryItem=item;
 galleryIndex=0;
 swipeStart=null;
 dialog.dataset.equipment=item.id;
 document.querySelector('#dialog-title').textContent=item.title;
 document.querySelector('#dialog-description').textContent=item.description || 'Informações a confirmar.';
 const photos=item.gallery || [];
 thumbnails.replaceChildren();
 gallery.hidden=!photos.length;
 photos.forEach((photo,index)=>{
  const button=document.createElement('button');
  button.type='button';
  button.className='gallery-thumbnail';
  button.setAttribute('aria-label',`${item.title}, selecionar foto ${index+1} de ${photos.length}`);
  const image=document.createElement('img');
  image.src=photo.src;image.alt='';image.decoding='async';
  image.width=1254;image.height=1254;
  button.append(image);
  button.addEventListener('click',()=>showGalleryImage(index));
  thumbnails.append(button);
 });
 showGalleryImage(0);
 dialog.showModal();
 dialog.scrollTop=0;
 document.body.classList.add('modal-open');
 dialog.querySelector('.dialog-close').focus();
}

gallery.querySelector('.gallery-prev').addEventListener('click',()=>showGalleryImage(galleryIndex-1));
gallery.querySelector('.gallery-next').addEventListener('click',()=>showGalleryImage(galleryIndex+1));
gallery.addEventListener('keydown',event=>{
 const next={ArrowLeft:galleryIndex-1,ArrowRight:galleryIndex+1,Home:0,End:(galleryItem?.gallery?.length || 1)-1}[event.key];
 if(next===undefined)return;
 event.preventDefault();
 showGalleryImage(next,thumbnails.contains(event.target));
});
// Arrasto horizontal por toque; a rolagem vertical do modal continua disponível.
galleryView.addEventListener('pointerdown',event=>{
 if(event.pointerType==='mouse'||!event.isPrimary||event.target.closest('button'))return;
 swipeStart={id:event.pointerId,x:event.clientX,y:event.clientY};
});
galleryView.addEventListener('pointerup',event=>{
 if(!swipeStart||swipeStart.id!==event.pointerId)return;
 const dx=event.clientX-swipeStart.x,dy=event.clientY-swipeStart.y;
 swipeStart=null;
 if(Math.abs(dx)>=40&&Math.abs(dx)>Math.abs(dy)*1.5)showGalleryImage(galleryIndex+(dx<0?1:-1));
});
galleryView.addEventListener('pointercancel',()=>{swipeStart=null;});

for(const item of equipment){
 const article=document.createElement('article');article.className='equipment';
 const slot=document.createElement('div');slot.className='media-slot equipment-media';slot.dataset.slot=item.id;
 if(item.image){
  slot.className='equipment-media equipment-cover';
  const image=document.createElement('img');
  image.src=item.image;image.alt=item.imageAlt || item.title;
  image.loading='lazy';image.decoding='async';image.width=1672;image.height=941;
  slot.append(image);
 }else{
  const cross=document.createElement('span');cross.className='slot-cross';cross.textContent='＋';cross.setAttribute('aria-hidden','true');
  const mediaLabel=document.createElement('span');mediaLabel.className='slot-label';mediaLabel.textContent='FOTO DO EQUIPAMENTO';slot.append(cross,mediaLabel);
 }
 const body=document.createElement('div');body.className='equipment-body';
 const label=document.createElement('p');label.className='eyebrow orange';label.textContent='EQUIPAMENTOS AVANSI';
 const h=document.createElement('h3');h.textContent=item.title;
 const p=document.createElement('p');p.textContent=item.description || 'Informações a confirmar.';
 const button=document.createElement('button');button.type='button';button.className='text-link dark';button.textContent='Ver detalhes';
 button.setAttribute('aria-label',`Ver detalhes de ${item.title}`);
 button.setAttribute('aria-haspopup','dialog');
 button.addEventListener('click',()=>openEquipmentDialog(item));
 body.append(label,h,p,button);article.append(slot,body);grid.append(article);
}
document.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
document.querySelector('#dialog-contact').addEventListener('click',()=>{
 if(galleryItem)selectInterest(galleryItem.id);
 restoreDialogFocus=false;
 dialog.close();
});
dialog.addEventListener('keydown',event=>{
 if(event.key!=='Tab')return;
 const controls=[...dialog.querySelectorAll('button:not([disabled]),a[href],[tabindex]')]
  .filter(element=>element.tabIndex>=0&&element.getClientRects().length);
 const first=controls[0],last=controls.at(-1);
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});
dialog.addEventListener('close',()=>{
 document.body.classList.remove('modal-open');
 swipeStart=null;
 if(restoreDialogFocus&&dialogOpener?.isConnected)dialogOpener.focus({preventScroll:true});
});
document.querySelector('#contact-form').addEventListener('submit',event=>event.preventDefault());
