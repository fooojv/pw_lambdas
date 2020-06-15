

let { PubSub }        = require('@google-cloud/pubsub')
const { Firestore }   = require('@google-cloud/firestore')
const fetch           = require('node-fetch')




const influxDBAPIURI =  'https://us-central1-1.gcp.cloud2.influxdata.com/api/v2/write?org=ede0ca526f31e56d&bucket=PureWaterTech&precision=s'
const influxDBAUTH =    '9OfCzrT_3U1kdbYBBttR3xQydlhXZ1R30eEGZABCqEFT-5HU9-BzALSS4sTA8mgGi3fsCeYGO5rG8vkNVz-7rg=='
var subscriptionForLocalUse
const firestore = new Firestore()
const mchsCol = firestore.collection('machines')
const storesCol = firestore.collection('stores')




if (process.platform === 'darwin')
{
  let config = {
    gcpProjectId: 'purewatertech',
    gcpPubSubSubscriptionName: 'comm.in_cli',
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
  if (msg.attributes.event === 'pw_status')             handleStatus(msg.attributes.device_id, data, cb)
  if (msg.attributes.event === 'pw_startup')            handleStartup(msg.attributes.device_id, data, cb)
  if (msg.attributes.event === 'pw_servicedoor')        handleServiceDoor(msg.attributes.device_id, data, cb)
}


async function handleStatus(particleId, statusStr, cb = ()=>{}) 
{
  let { info, status, error, debug, timestamp } = getDataFromStr(statusStr) 

  //await saveStatusToFireStore(status, error, debug)
  
  let { mchData, storeData } = await getFireStoreAuxData(particleId)

  let influxStr = `status,vers=0.7.2,mchId=${mchData.mchId},stId=${storeData.stId} glstr=${status.glstr},glpur=${status.glpur},glmin=${status.glmin} ${timestamp}\n`
  influxStr     += `errors,vers=0.7.2,mchId=${mchData.mchId},stId=${storeData.stId} drippan=${error.drippan},tnklvl=${error.tnklvl},aftrfilter=${error.aftrfilter},sumpovr=${error.sumpovr},uvbulb=${error.uvbulb},dispwr=${error.dispwr} ${timestamp}\n`
  influxStr     += `debug,vers=0.7.2,mchId=${mchData.mchId},stId=${storeData.stId} loop=${debug.loop},mloop=${debug.mloop},aloop=${debug.aloop} ${timestamp}`
  
  send(influxStr, Object.assign(info, status, error, mchData, {timestamp}), cb);
}


async function handleStartup(particleId, startupStr, cb = ()=>{}) 
{
  let status = {}
  let split = startupStr.split(',')

  for (let i = 0; i < split.length; i++) {
    if (i === 0)    status.state        = (Number)(split[0]);
    // no timestamp from device since it isnt guarenteed to have accurate time at moment of startup
  }

  status.timestamp = Math.floor(Date.now() / 1000)
  
  let { mchData, storeData } = await getFireStoreAuxData(particleId)

  let influxStr = `startup,vers=0.7.2,mchId=${mchData.mchId},stId=${storeData.stId} state=${status.state} ${status.timestamp}`
  
  send(influxStr, Object.assign(status, mchData ), cb);
}


async function handleServiceDoor(particleId, serviceDoorStr, cb = ()=>{}) 
{
  let status = {}
  let split = serviceDoorStr.split(',')

  for (let i = 0; i < split.length; i++) {
    if (i === 0)    status.state        = (Number)(split[0]);
    if (i === 1)    status.timestamp    = (Number)(split[1]);
  }
  
  let { mchData, storeData } = await getFireStoreAuxData(particleId)

  let influxStr = `servicedoor,vers=0.7.2,mchId=${mchData.mchId},stId=${storeData.stId} state=${status.state} ${status.timestamp}`
  
  send(influxStr, Object.assign(status, mchData ), cb);
}

function getDataFromStr(statusStr)
{
  let info = {}
  let status = {}
  let error = {}
  let debug = {}
  let timestamp = 0
  let split = statusStr.split(',')


  if (split[0] === "0.8.1")
  {
    for (let i = 0; i < split.length; i++) {
      if (i === 0)    info.version      = split[0];
      if (i === 1)    info.cellsig      = (Number)(split[1]);
      if (i === 2)    info.cellquality  = (Number)(split[2]);

      if (i === 3)    status.glstr      = (Number)(split[3]);
      if (i === 4)    status.glpur      = (Number)(split[4]);
      if (i === 5)    status.glmin      = (Number)(split[5]);
      
      if (i === 6)    error.drippan     = (Number)(split[6]);
      if (i === 7)    error.tnklvl      = (Number)(split[7]);
      if (i === 8)    error.aftrfilter  = (Number)(split[8]);
      if (i === 9)    error.sumpovr     = (Number)(split[9]);
      if (i === 10)   error.uvbulb      = (Number)(split[10]);
      if (i === 11)   error.dispwr      = (Number)(split[11]);
      
      if (i === 12)   debug.loop        = (Number)(split[12]);
      if (i === 13)   debug.mloop       = (Number)(split[13]);
      if (i === 14)   debug.aloop       = (Number)(split[14]);

      if (i === 15)   timestamp         = (Number)(split[15]);
    }
  }
  else 
  {
    for (let i = 0; i < split.length; i++) {
      if (i === 0)    status.glstr      = (Number)(split[0]);
      if (i === 1)    status.glpur      = (Number)(split[1]);
      if (i === 2)    status.glmin      = (Number)(split[2]);
      
      if (i === 3)    error.drippan     = (Number)(split[3]);
      if (i === 4)    error.tnklvl      = (Number)(split[4]);
      if (i === 5)    error.aftrfilter  = (Number)(split[5]);
      if (i === 6)    error.sumpovr     = (Number)(split[6]);
      if (i === 7)    error.uvbulb      = (Number)(split[7]);
      if (i === 8)    error.dispwr      = (Number)(split[8]);
      
      if (i === 9)    debug.loop        = (Number)(split[9]);
      if (i === 10)   debug.mloop       = (Number)(split[10]);
      if (i === 11)   debug.aloop       = (Number)(split[11]);

      if (i === 12)   timestamp         = (Number)(split[12]);
    }
  }

  return { info, status, error, debug, timestamp }
}

function getFireStoreAuxData(particleId) { return new Promise(async r=> 
{
  let mchData = {}
  let storeData = {}

  let mchDataCall = await mchsCol.where('particleId', '==', particleId).get()
  let mchDataCallData = mchDataCall.docs[0].data()
  mchData.mchId = mchDataCallData.mchId

  let storeDoc = await storesCol.doc(mchDataCallData.store_id).get()
  let storeDocData = storeDoc.data()
  storeData.stId = storeDocData.stId
  storeData.stNam = storeDocData.stNam

  r({mchData, storeData})
})}


function saveStatusToFireStore(status, error, debug) { return new Promise(async r=> 
{
  //let mchData = {}
  //let storeData = {}

  //let mchDataCall = await mchsCol.where('particleId', '==', particleId).get()
  //let mchDataCallData = mchDataCall.docs[0].data()
  //mchData.mchId = mchDataCallData.mchId

  //let storeDoc = await storesCol.doc(mchDataCallData.store_id).get()
  //let storeDocData = storeDoc.data()
  //storeData.stId = storeDocData.stId
  //storeData.stNam = storeDocData.stNam

  r()
})}


function send(influxStr, data, cb = ()=>{} )
{ 
  fetch(influxDBAPIURI, {
    method: 'POST',
    body:    influxStr,
    headers: { 'Authorization': `Token ${influxDBAUTH}`, }
  })

  fetch('https://pwtdata.com/iotEndpoint.php', {
    method: 'POST',
    headers: { 'Content-Type': `application/json`, },
    body: JSON.stringify(data)
  })

  cb()
}




//var stdin = process.openStdin();
//let statusStr = `38,23,198,1587573200`;
//let errorStr = `1,0,1587572990`;
//stdin.addListener("data", (e, f, g) => {
//  handleStatus('e00fce6889b1bad6d8029ede', statusStr);
//})




