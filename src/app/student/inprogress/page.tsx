"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { StudentLayout } from "@/components/student/StudentLayout";
import NextDynamic from "next/dynamic";

const AddChaptersModal = NextDynamic(() => import("@/components/student/AddChaptersModal"), { ssr: false });

const STEPS=["Paid","Assigned","Writing","QC","Done"];
const STATUS_STEPS:Record<string,number>={PENDING_PAYMENT:0,PAYMENT_CONFIRMED:1,IN_PROGRESS:2,QC_REVIEW:3,DELIVERED:4};
const isBankPending = (o:any) => o.status === 'PENDING_PAYMENT' && (o as any).paymentMethod === 'BANK_TRANSFER';
const isUnpaid      = (o:any) => {
  if (o.status !== 'PENDING_PAYMENT' || (o as any).paymentMethod === 'BANK_TRANSFER') return false;
  // Give a 10-minute grace period in case the student is still mid-checkout
  const ageMs = Date.now() - new Date(o.createdAt).getTime();
  return ageMs > 10 * 60 * 1000;
};

const C = {
  page:  { maxWidth:"640px", margin:"0 auto" },
  h1:    { fontFamily:"'Syne',sans-serif", fontSize:"1.6rem", fontWeight:800, color:"#0C1A2E", letterSpacing:"-.02em", marginBottom:".25rem" },
  sub:   { fontSize:".85rem", color:"#5B7EA6", marginBottom:"1.5rem" },
  card:  { background:"#fff", borderRadius:"16px", border:"1.5px solid #E0F2FE", padding:"1.25rem", marginBottom:"1rem" },
  ohead: { display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"1rem", marginBottom:"1rem" },
  otitle:{ fontFamily:"'Syne',sans-serif", fontSize:".9rem", fontWeight:700, color:"#0C1A2E" },
  ometa: { fontSize:".75rem", color:"#5B7EA6", marginTop:".25rem" },
  badge: { display:"inline-flex", padding:"3px 10px", borderRadius:"999px", fontSize:".68rem", fontWeight:700, flexShrink:0 as const },
  bY:    { background:"#FEF9C3", color:"#854D0E" },
  bS:    { background:"#E0F2FE", color:"#0369A1" },
  tracker:{ display:"flex", alignItems:"center", marginBottom:"1rem", position:"relative" as const },
  tline: { position:"absolute" as const, left:0, right:0, top:"16px", height:"2px", background:"#E0F2FE", zIndex:0 },
  tstep: { flex:1, display:"flex", flexDirection:"column" as const, alignItems:"center", position:"relative" as const, zIndex:1 },
  tdot:  { width:"32px", height:"32px", borderRadius:"50%", border:"2px solid #E0F2FE", background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:".75rem", color:"#5B7EA6" },
  tdotD: { width:"32px", height:"32px", borderRadius:"50%", border:"2px solid #38BDF8", background:"#38BDF8", display:"flex", alignItems:"center", justifyContent:"center", fontSize:".75rem", color:"#fff", fontWeight:700 },
  tdotA: { width:"32px", height:"32px", borderRadius:"50%", border:"2px solid #38BDF8", background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:".75rem", boxShadow:"0 0 0 3px rgba(56,189,248,.2)" },
  tlbl:  { fontSize:".6rem", fontWeight:600, marginTop:".3rem", color:"#5B7EA6", textAlign:"center" as const },
  tlblD: { fontSize:".6rem", fontWeight:600, marginTop:".3rem", color:"#0369A1", textAlign:"center" as const },
  tlblA: { fontSize:".6rem", fontWeight:700, marginTop:".3rem", color:"#0C1A2E", textAlign:"center" as const },
  chrow: { display:"flex", alignItems:"center", gap:".75rem", padding:".6rem .75rem", borderRadius:"10px", border:"1px solid #E0F2FE", marginBottom:".4rem", background:"rgba(240,249,255,.4)" },
  chnum: { width:"28px", height:"28px", borderRadius:"8px", background:"#E0F2FE", color:"#0369A1", fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:".75rem", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  chnumD:{ width:"28px", height:"28px", borderRadius:"8px", background:"#38BDF8", color:"#0C1A2E", fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:".75rem", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  chlbl: { flex:1, fontSize:".8rem", fontWeight:600, color:"#0C1A2E" },
  dlBtn: { fontSize:".75rem", fontWeight:600, color:"#0369A1", background:"none", border:"none", cursor:"pointer", textDecoration:"underline" },
  addBtn:{ display:"inline-flex", alignItems:"center", gap:".3rem", padding:".45rem .9rem", borderRadius:"8px", border:"1.5px solid #38BDF8", background:"#F0F9FF", color:"#0369A1", fontSize:".75rem", fontWeight:700, cursor:"pointer", marginTop:".75rem" },
  empty: { textAlign:"center" as const, padding:"4rem 1rem" },
  eicon: { fontSize:"2.5rem", marginBottom:".75rem" },
  etitle:{ fontFamily:"'Syne',sans-serif", fontSize:"1rem", fontWeight:700, color:"#0C1A2E" },
};

export default function StudentInProgress() {
  const [orders,  setOrders]  = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModal,setAddModal]= useState<string|null>(null);
  const [chapterReqs, setChapterReqs] = useState<any[]>([]);
  const [retrying, setRetrying] = useState<string|null>(null);

  function loadData() {
    fetch("/api/student/orders?filter=active")
      .then(r=>r.json())
      .then(d=>{ if(d.success) setOrders(d.data||[]); })
      .finally(()=>setLoading(false));
    fetch("/api/student/chapter-requests")
      .then(r=>r.json())
      .then(d=>{ if(d.success) setChapterReqs(d.data); });
  }

  async function retryPayment(orderId: string) {
    setRetrying(orderId);
    const res  = await fetch("/api/orders/retry-payment", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ orderId }),
    });
    const data = await res.json();
    if (res.ok && data.paymentUrl) {
      window.location.href = data.paymentUrl;
    } else {
      setRetrying(null);
      alert(data.error || "Could not start payment. Please try again.");
    }
  }

  const [editOrder,  setEditOrder]  = useState<any|null>(null);
  const [editForm,   setEditForm]   = useState({ topic:"", department:"", specialInstructions:"", guidelineFileUrl:"" });
  const [editing,    setEditing]    = useState(false);
  const [uploading,  setUploading]  = useState(false);

  function openEdit(order: any) {
    setEditOrder(order);
    setEditForm({
      topic:               order.topic || "",
      department:          order.department || "",
      specialInstructions: order.specialInstructions || "",
      guidelineFileUrl:    order.guidelineFileUrl || "",
    });
  }

  async function handleEditUpload() {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.zip,.mp3,.m4a,.wav";
    inp.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 20*1024*1024) { alert("Max 20MB"); return; }
      setUploading(true);
      const fd = new FormData(); fd.append("file", file); fd.append("folder", "orders/guidelines");
      const res  = await fetch("/api/upload", { method:"POST", body:fd });
      const data = await res.json();
      if (res.ok) {
        const existing = editForm.guidelineFileUrl ? editForm.guidelineFileUrl.split(",").filter(Boolean) : [];
        setEditForm(f => ({...f, guidelineFileUrl: [...existing, data.url].join(",")}));
      } else alert(data.error || "Upload failed.");
      setUploading(false);
    };
    inp.click();
  }

  async function handleSaveEdit() {
    if (!editOrder || !editForm.topic.trim()) { alert("Topic is required."); return; }
    setEditing(true);
    const res  = await fetch("/api/student/edit-order", {
      method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        orderId:             editOrder.id,
        topic:               editForm.topic.trim(),
        department:          editForm.department.trim(),
        specialInstructions: editForm.specialInstructions.trim() || null,
        guidelineFileUrl:    editForm.guidelineFileUrl || null,
      }),
    });
    const data = await res.json();
    if (res.ok) { setEditOrder(null); loadData(); }
    else alert(data.error || "Failed to save. Please try again.");
    setEditing(false);
  }

  useEffect(()=>{
    loadData();
    // If returning from a payment redirect (Paystack), the webhook may still be
    // processing — refetch a couple more times over the next few seconds to
    // catch the update without requiring a manual page refresh.
    const t1 = setTimeout(loadData, 2000);
    const t2 = setTimeout(loadData, 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  },[]);

  // Poll periodically while there's an unconfirmed bank transfer (order or add-chapters)
  // so the page updates automatically once admin confirms — no manual refresh needed.
  useEffect(() => {
    const hasPendingOrder   = orders.some(o => o.status === "PENDING_PAYMENT" && o.paymentMethod === "BANK_TRANSFER");
    const hasPendingChapter = chapterReqs.some(r => r.status === "PENDING_PAYMENT");
    if (!hasPendingOrder && !hasPendingChapter) return;

    const interval = setInterval(loadData, 20000); // every 20 seconds
    return () => clearInterval(interval);
  }, [orders, chapterReqs]);

  return (
    <StudentLayout>
      <div style={C.page}>
        <h1 style={C.h1}>Works in Progress</h1>
        <p style={C.sub}>Track each chapter of your active orders.</p>

        {loading ? <div style={{textAlign:"center",padding:"3rem",color:"#5B7EA6"}}>Loading...</div>
        : orders.length===0 ? (
          <div style={C.empty}>
            <div style={C.eicon}>⏳</div>
            <div style={C.etitle}>No active orders.</div>
          </div>
        ) : orders.map((order:any)=>{
          const curr = STATUS_STEPS[order.status]||0;
          const hasAllChapters = order.totalChapters >= 6;
          return (
            <div key={order.id} style={C.card}>
              <div style={C.ohead}>
                <div>
                  <div style={C.otitle}>{order.topic}</div>
                  <div style={C.ometa}>
                    {order.serviceType && order.serviceType !== "HIRE_WRITER"
                      ? order.serviceTypeLabel || order.serviceType.replace(/_/g," ")
                      : `${order.planName} Plan · ${order.deliveredChapters}/${order.totalChapters} chapters delivered`}
                  </div>
                </div>
                {isBankPending(order) ? (
                  <span style={{...C.badge, background:"#FEF9C3", color:"#854D0E"}}>⏳ Awaiting Payment Confirmation</span>
                ) : isUnpaid(order) ? (
                  <span style={{...C.badge, background:"#FEE2E2", color:"#991B1B"}}>⚠ Payment Not Completed</span>
                ) : (
                  <span style={{...C.badge,...(order.status==="QC_REVIEW"?C.bS:C.bY)}}>
                    {order.status==="QC_REVIEW"?"QC Review":"In Progress"}
                  </span>
                )}
              </div>

              {/* Order details — read only */}
              <details style={{marginBottom:"1rem"}}>
                <summary style={{fontSize:".78rem",color:"#0369A1",fontWeight:700,cursor:"pointer",listStyle:"none",display:"flex",alignItems:"center",gap:".3rem"}}>
                  📋 View Order Details
                </summary>
                <div style={{background:"#F8FAFC",borderRadius:"10px",padding:".85rem 1rem",marginTop:".5rem",fontSize:".78rem",color:"#475569",lineHeight:1.8}}>
                  <div><strong>Topic:</strong> {order.topic}</div>
                  {order.department && <div><strong>Department:</strong> {order.department}</div>}
                  <div><strong>Degree:</strong> {order.degreeGroup?.replace(/_/g," ")}</div>
                  {order.planName && <div><strong>Plan:</strong> {order.planName?.replace(/_/g," ")}</div>}
                  {order.selectedChapters && <div><strong>Chapters:</strong> {order.selectedChapters.split(",").map((c:string)=>`Chapter ${c}`).join(", ")}</div>}
                  {order.specialInstructions && <div><strong>Instructions:</strong> <span style={{whiteSpace:"pre-wrap"}}>{order.specialInstructions}</span></div>}
                  {order.guidelineFileUrl && (
                    <div><strong>Guideline Files:</strong>{" "}
                      {order.guidelineFileUrl.split(",").filter(Boolean).map((url:string,i:number,arr:string[])=>(
                        <a key={i} href={`/api/download/guideline?url=${encodeURIComponent(url.trim())}&label=Guideline`}
                          target="_blank" rel="noreferrer" style={{color:"#0369A1",fontWeight:600,marginRight:".5rem"}}>
                          📎 File{arr.length>1?` ${i+1}`:""}
                        </a>
                      ))}
                    </div>
                  )}
                  <div style={{marginTop:".5rem",fontSize:".72rem",color:"#94A3B8"}}>
                    To make changes to your order details, please contact support.
                  </div>
                </div>
              </details>

              {/* Unpaid order — retry payment notice */}
              {isUnpaid(order) && (
                <div style={{background:"#FEF2F2",border:"1px solid #FCA5A5",borderRadius:"10px",padding:".85rem 1rem",marginBottom:"1rem"}}>
                  <p style={{fontSize:".78rem",color:"#991B1B",lineHeight:1.5,marginBottom:".6rem"}}>
                    ⚠ Your payment was not completed for this order. Your work hasn't started yet — complete payment to begin.
                  </p>
                  <button
                    disabled={retrying===order.id}
                    onClick={()=>retryPayment(order.id)}
                    style={{padding:".6rem 1.1rem",borderRadius:"10px",background:"#38BDF8",color:"#0C1A2E",fontSize:".8rem",fontWeight:700,border:"none",cursor:"pointer"}}>
                    {retrying===order.id ? "Processing..." : "💳 Complete Payment →"}
                  </button>
                </div>
              )}

              {/* Bank transfer notice */}
              {isBankPending(order) && (
                <div style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:"10px",padding:".75rem 1rem",marginBottom:"1rem",fontSize:".78rem",color:"#9A3412",lineHeight:1.5}}>
                  🏦 <strong>Payment Pending:</strong> Your bank transfer order has been received. Once we confirm your payment, your chapters will be assigned and work will begin. This usually takes within 30 minutes during business hours.
                  {(order as any).bankTransferReference && (
                    <div style={{marginTop:".4rem"}}>Reference: <strong style={{fontFamily:"monospace"}}>{(order as any).bankTransferReference}</strong></div>
                  )}
                  <div style={{marginTop:".75rem"}}>
                    <button onClick={()=>openEdit(order)}
                      style={{padding:".45rem 1rem",borderRadius:"8px",background:"#EDE9FE",color:"#5B21B6",border:"none",cursor:"pointer",fontSize:".78rem",fontWeight:700}}>
                      ✏️ Edit My Request
                    </button>
                    <span style={{marginLeft:".5rem",fontSize:".72rem",color:"#92400E"}}>Payment not yet confirmed — you can still make changes.</span>
                  </div>
                </div>
              )}

              {/* Pending/confirmed add-chapter requests for this order */}
              {chapterReqs.filter(r => r.orderId === order.id).map(r => (
                <div key={r.id} style={{
                  background: r.status === "PENDING_PAYMENT" ? "#FFF7ED" : "#F0FDF4",
                  border: `1px solid ${r.status === "PENDING_PAYMENT" ? "#FED7AA" : "#BBF7D0"}`,
                  borderRadius:"10px", padding:".75rem 1rem", marginBottom:"1rem",
                  fontSize:".78rem", color: r.status === "PENDING_PAYMENT" ? "#9A3412" : "#166534", lineHeight:1.5
                }}>
                  {r.status === "PENDING_PAYMENT" ? (
                    <>📎 <strong>Additional Chapter(s) Pending:</strong> You requested Chapter(s) {r.chapterNumbers.split(",").join(", ")} via bank transfer (₦{(r.amountKobo/100).toLocaleString()}). Awaiting payment confirmation.</>
                  ) : (
                    <>✅ <strong>Additional Chapter(s) Confirmed:</strong> Chapter(s) {r.chapterNumbers.split(",").join(", ")} have been assigned and work has begun.</>
                  )}
                  <div style={{marginTop:".3rem"}}>Reference: <strong style={{fontFamily:"monospace"}}>{r.reference}</strong></div>
                </div>
              ))}

              {/* Progress tracker */}
              <div style={C.tracker}>
                <div style={C.tline}/>
                {STEPS.map((label,i)=>{
                  const done=i<curr, act=i===curr;
                  return (
                    <div key={label} style={C.tstep}>
                      <div style={done?C.tdotD:act?C.tdotA:C.tdot}>{done?"✓":i+1}</div>
                      <span style={done?C.tlblD:act?C.tlblA:C.tlbl}>{label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Chapters */}
              {order.chapters?.map((ch:any)=>(
                <div key={ch.id} style={C.chrow}>
                  <div style={ch.status==="DELIVERED"?C.chnumD:C.chnum}>{ch.chapterNumber}</div>
                  <span style={C.chlbl}>{ch.chapterLabel}</span>
                  {ch.status==="DELIVERED"&&ch.deliveredFileUrl
                    ? <button style={C.dlBtn} onClick={()=>window.open(`/api/download?chapterId=${ch.id}`,"_blank")}>⬇ Download</button>
                    : <span style={{fontSize:".72rem",color:ch.status==="IN_PROGRESS"?"#CA8A04":ch.status==="QC_IN_PROGRESS"?"#0369A1":"#5B7EA6"}}>
                        {ch.status==="IN_PROGRESS"?"Writing...":ch.status==="QC_IN_PROGRESS"?"QC Review":"Queued"}
                      </span>}
                </div>
              ))}

              {/* Add more chapters button — only for project/thesis orders */}
              {!hasAllChapters && (!order.serviceType || order.serviceType === "HIRE_WRITER") && (
                <button style={C.addBtn} onClick={()=>setAddModal(order.id)}>
                  ➕ Add More Chapters
                </button>
              )}
            </div>
          );
        })}
      </div>

      {addModal && (
        <AddChaptersModal orderId={addModal} onClose={()=>{ setAddModal(null); loadData(); }} />
      )}

      {/* Edit Order Modal */}
      {editOrder && (
        <div style={{position:"fixed" as const,inset:0,background:"rgba(12,26,46,.6)",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}
          onClick={e=>{if(e.target===e.currentTarget){setEditOrder(null);}}}>
          <div style={{background:"#fff",borderRadius:"20px",padding:"1.75rem",maxWidth:"500px",width:"100%",maxHeight:"90vh",overflowY:"auto" as const}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:"1rem",fontWeight:800,color:"#0C1A2E",marginBottom:".25rem"}}>✏️ Edit Your Request</div>
            <div style={{fontSize:".78rem",color:"#5B7EA6",marginBottom:"1.25rem"}}>Changes will be reviewed when we confirm your payment.</div>

            <div style={{marginBottom:"1rem"}}>
              <label style={{fontSize:".68rem",fontWeight:700,textTransform:"uppercase" as const,letterSpacing:".08em",color:"#0C1A2E",display:"block",marginBottom:".4rem"}}>Project Topic</label>
              <textarea rows={3} value={editForm.topic} onChange={e=>setEditForm(f=>({...f,topic:e.target.value}))}
                style={{width:"100%",padding:".65rem 1rem",borderRadius:"10px",border:"1.5px solid #BAE6FD",fontSize:".85rem",outline:"none",boxSizing:"border-box" as const,resize:"vertical" as const}} />
            </div>

            <div style={{marginBottom:"1rem"}}>
              <label style={{fontSize:".68rem",fontWeight:700,textTransform:"uppercase" as const,letterSpacing:".08em",color:"#0C1A2E",display:"block",marginBottom:".4rem"}}>Department / Course</label>
              <input value={editForm.department} onChange={e=>setEditForm(f=>({...f,department:e.target.value}))}
                style={{width:"100%",padding:".65rem 1rem",borderRadius:"10px",border:"1.5px solid #BAE6FD",fontSize:".85rem",outline:"none",boxSizing:"border-box" as const}}
                placeholder="e.g. Business Administration" />
            </div>

            <div style={{marginBottom:"1rem"}}>
              <label style={{fontSize:".68rem",fontWeight:700,textTransform:"uppercase" as const,letterSpacing:".08em",color:"#0C1A2E",display:"block",marginBottom:".4rem"}}>Special Instructions <span style={{fontWeight:400,textTransform:"none" as const,color:"#94A3B8"}}>(optional)</span></label>
              <textarea rows={3} value={editForm.specialInstructions} onChange={e=>setEditForm(f=>({...f,specialInstructions:e.target.value}))}
                style={{width:"100%",padding:".65rem 1rem",borderRadius:"10px",border:"1.5px solid #BAE6FD",fontSize:".85rem",outline:"none",boxSizing:"border-box" as const,resize:"vertical" as const}}
                placeholder="Any additional instructions or corrections..." />
            </div>

            <div style={{marginBottom:"1.25rem"}}>
              <label style={{fontSize:".68rem",fontWeight:700,textTransform:"uppercase" as const,letterSpacing:".08em",color:"#0C1A2E",display:"block",marginBottom:".4rem"}}>Guideline Files <span style={{fontWeight:400,textTransform:"none" as const,color:"#94A3B8"}}>(optional)</span></label>
              {editForm.guidelineFileUrl && editForm.guidelineFileUrl.split(",").filter(Boolean).map((url:string,i:number,arr:string[])=>(
                <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:"8px",padding:".4rem .75rem",marginBottom:".4rem",fontSize:".78rem"}}>
                  <span style={{color:"#065F46",fontWeight:600}}>📎 {url.split("/").pop()?.slice(0,35)||`File ${i+1}`}</span>
                  <button onClick={()=>{
                    const updated = arr.filter((_:string,j:number)=>j!==i).join(",");
                    setEditForm(f=>({...f,guidelineFileUrl:updated}));
                  }} style={{background:"none",border:"none",cursor:"pointer",color:"#EF4444"}}>✕</button>
                </div>
              ))}
              <div onClick={handleEditUpload}
                style={{border:"2px dashed #BAE6FD",borderRadius:"10px",padding:".65rem",textAlign:"center" as const,cursor:uploading?"not-allowed":"pointer",background:"#F8FCFF",fontSize:".78rem",color:"#5B7EA6"}}>
                {uploading?"⏳ Uploading...":"📎 Click to upload guideline · PDF, Word, images, ZIP · Max 20MB"}
              </div>
            </div>

            <div style={{display:"flex",gap:".75rem"}}>
              <button onClick={handleSaveEdit} disabled={editing}
                style={{flex:1,padding:".75rem",borderRadius:"12px",border:"none",background:"#0C1A2E",color:"#38BDF8",fontSize:".88rem",fontWeight:700,cursor:editing?"not-allowed":"pointer",opacity:editing?0.6:1}}>
                {editing?"Saving...":"💾 Save Changes"}
              </button>
              <button onClick={()=>setEditOrder(null)}
                style={{padding:".75rem 1.25rem",borderRadius:"12px",border:"1.5px solid #BAE6FD",background:"#fff",cursor:"pointer",fontSize:".85rem",fontWeight:700,color:"#5B7EA6"}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </StudentLayout>
  );
}
