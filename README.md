
# Pure Water Google Cloud Functions (Comm-in function specifically)

Triggered by pub/sub. This handles error and status incoming updates in the handlePubIn function. This looks for event string on the msg.attribute object to deterime which it is. The data is expected to be a base64 encoded string of values seperated by ','. A split is performed. And gathers data BASED UPON ITS POSITION. 

**Connected Systems:**

This sends data out to influxDB via HTTP API. Also, sends out to Alan's server via HTTP API. But, before this, it pulls extra information from the Firestore database based upon Particle device_id.
