import HelperApp from '@/components/helper-app';
import {initialSnapshot}from'@/lib/site-data';
export const dynamic='force-dynamic';
export async function generateMetadata(){const{settings}=await initialSnapshot();return{title:settings.content.siteName,description:settings.content.description,openGraph:{title:settings.content.siteName,description:settings.content.description}};}
export default async function Page(){
 const data=await initialSnapshot();
 return <HelperApp initialCodes={data.codes.map(i=>i.code)} initialItems={data.codes} initialContent={data.settings.content} initialLive={data.live} initialReady={data.acceptingSubmissions} initialAutoApprove={data.settings.autoApprove} initialEtag={data.etag} initialError={data.error}/>;
}
