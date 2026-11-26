# Binary service transport

`ServiceClient.uploadBinary(service, metadata, body)` sends a Blob, ArrayBuffer
or typed array as an octet-stream POST. Metadata uses the existing query
encoding and responses use the native Drumee envelope/error contract.

It shares the private transport state, credentials mode and session-header
rotation of fetchService/postService. It exposes no session identifier or
Response to plugins and introduces no application-specific upload service.
The server remains responsible for authorization and size limits.

This is the missing generic transport adapter consumed by Finder's existing
MfsTransferClient. Source boundaries: src/service.js and Finder
lib/mfs-transfer-client.js at b46e2c94b615a1993b6162716d9e8965d0029564;
the binary tempfile and preauthorization boundary already exists in
server-runtime alpha.3. No npm release or dependency version change is made.
