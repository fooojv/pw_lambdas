

let { PubSub }        = require('@google-cloud/pubsub')
const { Firestore }   = require('@google-cloud/firestore')
const fetch           = require('node-fetch')




const influxDBAPIURI =  'https://us-central1-1.gcp.cloud2.influxdata.com/api/v2/write?org=ede0ca526f31e56d&bucket=PureWaterTech&precision=s'
const influxDBAUTH =    '9OfCzrT_3U1kdbYBBttR3xQydlhXZ1R30eEGZABCqEFT-5HU9-BzALSS4sTA8mgGi3fsCeYGO5rG8vkNVz-7rg=='
var   subscriptionForLocalUse
const firestore = new Firestore()
const mchsCol = firestore.collection('machines')
const storesCol = firestore.collection('stores')




const REPORT_TIME_INTERVAL = 86400 // 24 hours in seconds




async function SaveStatus(particleId, statusStr, cb = ()=>{})  {
  let { info, status, error, debug, timestamp } = _getDataFromStr(statusStr) 

  let { mchData, storeData } = await _getFireStoreAuxData(particleId)
  
  let gl = {
    glstr: mchData.glstr + (status.glstr * mchData.glstrI),
    glpur: mchData.glpur + (status.glpur * mchData.glpurI),
    glmin: mchData.glmin + (status.glmin * mchData.glminI)
  }

  await _saveStatusToFireStore(mchData.mchDocId, gl)

  let influxStr = `status,vers=0.7.2,mchId=${mchData.mchId},stId=${storeData.stId} glstr=${gl.glstr},glpur=${gl.glpur},glmin=${gl.glmin} ${timestamp}\n`
  influxStr     += `errors,vers=0.7.2,mchId=${mchData.mchId},stId=${storeData.stId} drippan=${error.drippan},tnklvl=${error.tnklvl},aftrfilter=${error.aftrfilter},sumpovr=${error.sumpovr},uvbulb=${error.uvbulb},dispwr=${error.dispwr} ${timestamp}`
  
  _send(influxStr, Object.assign(info, status, error, mchData, {timestamp}), cb);
}




async function SaveStartup(particleId, startupStr, cb = ()=>{}) {
  let status = {}
  let split = startupStr.split(',')

  for (let i = 0; i < split.length; i++) {
    if (i === 0)    status.state        = (Number)(split[0]);
    // no timestamp from device since it isnt guarenteed to have accurate time at moment of startup
  }

  status.timestamp = Math.floor(Date.now() / 1000)
  
  let { mchData, storeData } = await _getFireStoreAuxData(particleId)

  let influxStr = `startup,vers=0.7.2,mchId=${mchData.mchId},stId=${storeData.stId} state=${status.state} ${status.timestamp}`
  
  _send(influxStr, Object.assign(status, mchData ), cb);
}




async function SaveServiceDoor(particleId, serviceDoorStr, cb = ()=>{}) {
  let status = {}
  let split = serviceDoorStr.split(',')

  for (let i = 0; i < split.length; i++) {
    if (i === 0)    status.state        = (Number)(split[0]);
    if (i === 1)    status.timestamp    = (Number)(split[1]);
  }
  
  let { mchData, storeData } = await _getFireStoreAuxData(particleId)

  let influxStr = `servicedoor,vers=0.7.2,mchId=${mchData.mchId},stId=${storeData.stId} state=${status.state} ${status.timestamp}`
  
  _send(influxStr, Object.assign(status, mchData ), cb);
}




async function SaveReportConnection(cb = ()=>{}) {
  let machines = [] 
  let nowStamp = Date.now() / 1000

  let mchs = await mchsCol.get()

  mchs.forEach(mch => {
    let d = mch.data()
    let unixTS = (d.lastCon.toDate()).getTime() / 1000
    let isActiveRecently = ((nowStamp - unixTS) < REPORT_TIME_INTERVAL)

    machines.push({
      connected: isActiveRecently,
      mchId: d.mchId
    })
  })

   
  fetch('https://pwtdata.com/iotEndpoint.php', {
    method: 'POST',
    headers: { 'Content-Type': `application/json`, },
    body: JSON.stringify(machines)
  })

  cb()
} 




function _routePubIn(msg, cb = ()=>{}) {
  let data = Buffer.from(msg.data, 'base64').toString()

  if (data === 'reportconnectioncron' || data === 'reportconnectioncron_dev')             SaveReportConnection(cb)

  if (msg && msg.attributes && msg.attributes.event) {
    let ev = msg.attributes.event

    if (ev == 'pw_status' || ev == 'pw_dev_status')                                       SaveStatus(msg.attributes.device_id, data, cb)
    else if (ev == 'pw_startup' || ev == 'pw_dev_startup')                                SaveStartup(msg.attributes.device_id, data, cb)
    else if (ev == 'pw_servicedoor' || ev == 'pw_dev_servicedoor')                        SaveServiceDoor(msg.attributes.device_id, data, cb)
  }

}




function _getDataFromStr(statusStr) {
  let info = {}
  let status = {}
  let error = {}
  let debug = {}
  let timestamp = 0
  let split = statusStr.split(',')


  if (split[0] === "0.8.3")
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
      if (i === 12)   error.flowstuk    = (Number)(split[12]);
      
      if (i === 13)   timestamp         = (Number)(split[13]);
    }
  }
  else if (split[0] === "0.8.2") 
  {
  }

  return { info, status, error, debug, timestamp }
}




function _getFireStoreAuxData(particleId) { return new Promise(async cb=> {
  let mchData = {}
  let storeData = {}

  let mchDataCall = await mchsCol.where('particleId', '==', particleId).get()
  let mchDataCallData = mchDataCall.docs[0].data()
  mchData.mchId = mchDataCallData.mchId
  mchData.glstr = mchDataCallData.glstr
  mchData.glpur = mchDataCallData.glpur
  mchData.glmin = mchDataCallData.glmin
  mchData.glstrI = mchDataCallData.glstrI
  mchData.glpurI = mchDataCallData.glpurI
  mchData.glminI = mchDataCallData.glminI

  mchData.mchDocId = mchDataCall.docs[0].id

  let storeDoc = await storesCol.doc(mchDataCallData.store_id).get()
  let storeDocData = storeDoc.data()
  storeData.stId = storeDocData.stId
  storeData.stNam = storeDocData.stNam

  cb({mchData, storeData})
})}




function _saveStatusToFireStore(mchDocId, gl) { return new Promise(async cb=>  {
  let mch = mchsCol.doc(mchDocId)

  await mch.update({
    lastCon: (Firestore.Timestamp.fromMillis(Date.now())),
    glstr: gl.glstr,
    glpur: gl.glpur,
    glmin: gl.glmin
  })
  
  cb()
})}




function _send(influxStr, data, cb = ()=>{} ) { 
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




if (process.platform === 'darwin') {
  let config = {
    gcpProjectId: 'purewatertech',
    gcpPubSubSubscriptionName: 'cli_dev',
    gcpServiceAccountKeyFilePath: '/Users/xenition/.ssh/googlekeys/purewatertech-ccd15301df05.json'
  }
  
  let pubsub = new PubSub({
    projectId: config.gcpProjectId,
    keyFilename: config.gcpServiceAccountKeyFilePath,
  })
  subscriptionForLocalUse = pubsub.subscription(config.gcpPubSubSubscriptionName);
  
  subscriptionForLocalUse.on('message', message => {
    _routePubIn(message)
    message.ack();
  });
}



exports.mainPubSub = (event, context, callback) => {   _routePubIn(event, callback);   }; 



