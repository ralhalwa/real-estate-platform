import type { Metadata } from 'next';
import './globals.css';
import './modern.css';
export const metadata:Metadata={title:'بيت | Bayt — مساحة لبداية جديدة',description:'بيت، منصة عقارية لسوريا. ابحث عن منزلك، تواصل مع الوكيل، وأدر عقاراتك في مساحة واحدة.',robots:{index:false,follow:false},icons:{icon:'/logo.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ar" dir="rtl"><body>{children}</body></html>}
