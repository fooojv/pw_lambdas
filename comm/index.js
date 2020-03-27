

let { PubSub }        = require('@google-cloud/pubsub')
const { Firestore }   = require('@google-cloud/firestore')
const fetch           = require('node-fetch')




const influxDBAPIURI = 'https://us-central1-1.gcp.cloud2.influxdata.com/api/v2/write?org=ede0ca526f31e56d&bucket=PureWaterTech&precision=s'
const influxDBAUTH = '9OfCzrT_3U1kdbYBBttR3xQydlhXZ1R30eEGZABCqEFT-5HU9-BzALSS4sTA8mgGi3fsCeYGO5rG8vkNVz-7rg=='
var subscriptionForLocalUse
const firestore = new Firestore()
const mchsCol = firestore.collection('machines')
const storesCol = firestore.collection('stores')




if (process.platform === 'darwin')
{
  let config = {
    gcpProjectId: 'purewatertech',
    gcpPubSubSubscriptionName: 'comm.in-cli',
    gcpServiceAccountKeyFilePath: '/Users/xenition/.ssh/googlekeys/purewatertech-ccd15301df05.json'
  }
  
  
  let pubsub = new PubSub({
    projectId: config.gcpProjectId,
    keyFilename: config.gcpServiceAccountKeyFilePath,
  })
  subscriptionForLocalUse = pubsub.subscription(config.gcpPubSubSubscriptionName);
  
  
  subscriptionForLocalUse.on('message', message => {
    handlePubIn(message)
    message.ack();
  });
}




exports.commInPubSub = (event, context, callback) => {
  handlePubIn(event, callback)
};




function handlePubIn(msg, cb = ()=>{}) {
  let data = Buffer.from(msg.data, 'base64').toString()

  if (msg.attributes.event === 'status')      handleStatus(msg.attributes.device_id, data, cb)
  if (msg.attributes.event === 'error')       handleError(msg.attributes.device_id, data, cb)
}


async function handleStatus(particleId, statusStr, cb = ()=>{}) 
{
  let status = {}
  let split = statusStr.split(',')

  split.forEach(i=>{
    let p = i.split(':')
    
    if (p[0] === 'time')        status.timestamp = (Number)(p[1])
    if (p[0] === 'glstr')       status.glstr     = (Number)(p[1])
    if (p[0] === 'glpur')       status.glpur     = (Number)(p[1])
    if (p[0] === 'glmin')       status.glmin     = (Number)(p[1])
  })

  let store = await getFireStoreAuxData(particleId)
  Object.assign(status, store)
  
  let influxStr = `status_v0.5.6,vers=0.5.6,mchId=${status.mchId},stId=${status.stId},stNam=${status.stNam} glstr=${status.glstr},glpur=${status.glpur},glmin=${status.glmin} ${status.timestamp}`
  
  send(Object.assign(status, {mode: 'status'}), influxStr)
}


async function handleError(particleId, errorStr, cb = ()=>{}) 
{
  let error = {}
  let split = errorStr.split(',')

  split.forEach(i=>{
    let p = i.split(':')
    
    if (p[0] === 'time')    error.timestamp = (Number)(p[1])
    if (p[0] === 'id')      error.id        = (Number)(p[1])
    if (p[0] === 'state')   error.state     = (Number)(p[1])
  })

  let store = await getFireStoreAuxData(particleId)
  Object.assign(error, store)
  
  let influxStr = `error_v0.5.7,vers=0.5.7,mchId=${error.mchId},stId=${error.stId},stNam=${error.stNam} err_${error.id}=${error.state} ${error.timestamp}`
  
  send(Object.assign(error, {mode: 'error'}), influxStr)
}


function getFireStoreAuxData(particleId) { return new Promise(async r=> 
{
  let obj = {}

  let mchData = await mchsCol.where('particleId', '==', particleId).get()
  mchData = mchData.docs[0].data()
  obj.mchId = mchData.mchId


  let storeData = await storesCol.doc(mchData.store_id).get()
  storeData = doc.data()
  obj.stId = storeData.stId
  obj.stNam = storeData.stNam

  res(obj)
})}


function send(obj, influxStr)
{
  fetch(influxDBAPIURI, {
    method: 'POST',
    body:    influxStr,
    headers: { 'Authorization': `Token ${influxDBAUTH}`, }
  })

  fetch('https://pwtdata.com/iotEndpoint.php', {
    method: 'POST',
    body: JSON.stringify(obj)
  })
}




var stdin = process.openStdin();
let str = `glstr:32,glpur:43,glmin:98,time:1581740941`;
stdin.addListener("data", (e, f, g) => {
  handleStatus('e00fce6889b1bad6d8029ede', str);
})

