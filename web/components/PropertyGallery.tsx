'use client';
import {useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Images} from 'lucide-react';
export default function PropertyGallery({images,title,arabic=false}:{images:string[];title:string;arabic?:boolean}){
 const [index,setIndex]=useState(0);const start=useRef<number|null>(null);
 const photos=images.length?images:['/images/courtyard.jpg'];
 const move=(step:number)=>setIndex(i=>(i+step+photos.length)%photos.length);
 return <section className="photo-gallery" aria-label={arabic?'صور العقار':'Property photos'} onKeyDown={e=>{if(e.key==='ArrowRight'){e.preventDefault();move(1)}if(e.key==='ArrowLeft'){e.preventDefault();move(-1)}}}>
 <div className="photo-stage" dir="ltr" onTouchStart={e=>{start.current=e.touches[0].clientX}} onTouchEnd={e=>{if(start.current===null)return;const delta=e.changedTouches[0].clientX-start.current;if(Math.abs(delta)>45)move(delta<0?1:-1);start.current=null}}>
 <div className="photo-track" style={{transform:`translateX(-${index*100}%)`}}>{photos.map((url,i)=><img src={url} alt={`${title} — ${arabic?'صورة':'Photo'} ${i+1}`} key={i} aria-hidden={i!==index} draggable={false}/>)}</div>
 {photos.length>1&&<><button type="button" className="photo-arrow photo-prev" onClick={()=>move(-1)} aria-label={arabic?'الصورة السابقة':'Previous photo'}><ArrowLeft size={20}/></button><button type="button" className="photo-arrow photo-next" onClick={()=>move(1)} aria-label={arabic?'الصورة التالية':'Next photo'}><ArrowRight size={20}/></button></>}
 <span className="photo-counter" aria-live="polite" aria-atomic="true"><Images size={15}/>{index+1} / {photos.length}</span>
 </div>
 <div className="photo-gallery-footer"><span>{photos.length} {arabic?'صور':'photos'}</span>{photos.length>1&&<span>{arabic?'اسحب أو استخدم الأسهم للتصفّح':'Swipe or use the arrows to explore'}</span>}</div>
 {photos.length>1&&<div className="photo-thumbnails" dir="ltr">{photos.map((url,i)=><button type="button" key={i} className={index===i?'active':''} onClick={()=>setIndex(i)} aria-label={`${arabic?'عرض الصورة':'View photo'} ${i+1}`} aria-pressed={index===i}><img src={url} alt=""/><span>{i+1}</span></button>)}</div>}
 </section>
}
