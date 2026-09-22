export function getBuyerId() {
  let id = localStorage.getItem('adminpilot_buyer_id');
  if(!id){
    const random = crypto.randomUUID?.() || (Math.random().toString(36).slice(2) + Date.now().toString(36));
    id = 'buyer_' + random.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
    localStorage.setItem('adminpilot_buyer_id', id);
  }
  return id;
}

export function getBuyerEmail() {
  return localStorage.getItem('adminpilot_buyer_email') || '';
}

export function saveBuyerEmail(email: string) {
  if (email) {
    localStorage.setItem('adminpilot_buyer_email', email.trim());
  }
}
