class BoundedCache extends Map {
  constructor(limit=128) {super();this.limit=limit;}
  ttl(key) {return ['static','items','stats'].includes(key)?86400000:key.startsWith('exchange-server:')||key.startsWith('[')?60000:900000;}
  get(key) {
    const hit=super.get(key);
    if(hit && Date.now()-hit.time>=this.ttl(key)){super.delete(key);return undefined;}
    return hit;
  }
  set(key,value) {
    for(const existing of this.keys())this.get(existing);
    super.delete(key);super.set(key,value);
    while(this.size>this.limit){const oldest=[...this.keys()].find(k=>!['static','items','stats'].includes(k));if(oldest===undefined)break;super.delete(oldest);}
    return this;
  }
}
module.exports={BoundedCache};
