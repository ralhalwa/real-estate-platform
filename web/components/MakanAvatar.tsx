'use client';

import {useRef} from 'react';
import {X} from 'lucide-react';
import type {Language} from '@/lib/model';

type AvatarRole='admin'|'manager'|'agent'|'staff'|'customer';

export default function MakanAvatar({name, photoUrl, previewLanguage, className='initial', role='customer'}:{
 name?:string|null;
 photoUrl?:string;
 previewLanguage?:Language;
 className?:string;
 role?:AvatarRole;
}){
 const dialog=useRef<HTMLDialogElement>(null);
 const initials=(name||'').trim().split(/\s+/u).filter(Boolean).slice(0,2)
  .map(word=>Array.from(word)[0].toLocaleUpperCase())
  .join('');

 const avatarClass=className+' makan-avatar';
 const photo=photoUrl&&<img className="makan-avatar-photo" src={photoUrl} alt=""/>;
 if(!photoUrl||!previewLanguage){
  return <span className={avatarClass} data-avatar-role={role} aria-hidden="true">{photo||initials||'M'}</span>;
 }

 const arabic=previewLanguage==='ar';
 const title=name
  ? (arabic?'صورة الملف الشخصي: ':'Profile photo: ')+name
  : arabic?'صورة الملف الشخصي':'Profile photo';
 return <>
  <button type="button" className={avatarClass+' makan-avatar-preview-trigger'} data-avatar-role={role}
   aria-label={title} aria-haspopup="dialog" onClick={()=>dialog.current?.showModal()}>
   {photo}
  </button>
  <dialog ref={dialog} className="makan-avatar-preview" aria-label={title}
   onCancel={event=>event.stopPropagation()}
   onClick={event=>{if(event.target===event.currentTarget)event.currentTarget.close()}}>
   <div className="makan-avatar-preview-content">
    <button type="button" className="icon-btn makan-avatar-preview-close" aria-label={arabic?'إغلاق الصورة':'Close photo'}
     onClick={()=>dialog.current?.close()}><X size={20}/></button>
    <img src={photoUrl} alt={title} loading="lazy"/>
   </div>
  </dialog>
 </>;
}
