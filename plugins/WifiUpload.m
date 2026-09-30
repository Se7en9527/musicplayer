#import "WifiUpload.h"
#import <GCDWebServer/GCDWebServer.h>
#import <GCDWebServer/GCDWebServerDataResponse.h>
#import <GCDWebServer/GCDWebServerUploadResponse.h>
#import <ifaddrs.h>
#import <arpa/inet.h>

@interface WifiUpload ()
@property (nonatomic, strong) GCDWebServer *server;
@end

@implementation WifiUpload

RCT_EXPORT_MODULE();

- (NSArray<NSString *> *)supportedEvents {
  return @[@"onUpload"];
}

+ (BOOL)requiresMainQueueSetup { return NO; }

- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }

- (NSString *)wifiAddress {
  NSString *address = @"127.0.0.1";
  struct ifaddrs *interfaces = NULL;
  if (getifaddrs(&interfaces) == 0) {
    struct ifaddrs *ifa = interfaces;
    while (ifa != NULL) {
      if (ifa->ifa_addr->sa_family == AF_INET) {
        NSString *name = [NSString stringWithUTF8String:ifa->ifa_name];
        if ([name isEqualToString:@"en0"]) {
          struct sockaddr_in *sa = (struct sockaddr_in *)ifa->ifa_addr;
          address = [NSString stringWithUTF8String:inet_ntoa(sa->sin_addr)];
          break;
        }
      }
      ifa = ifa->ifa_next;
    }
    freeifaddrs(interfaces);
  }
  NSInteger port = self.server ? self.server.port : 8080;
  return [NSString stringWithFormat:@"http://%@:%ld", address, (long)port];
}

RCT_EXPORT_METHOD(startServer:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  if (self.server) { resolve([self wifiAddress]); return; }
  GCDWebServer *server = [[GCDWebServer alloc] init];
  NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
  NSString *docs = paths.firstObject;

  [server addHandlerForMethod:@"POST" path:@"/upload"
                 requestClass:[GCDWebServerMultiPartFormRequest class]
                 processBlock:^GCDWebServerResponse *(GCDWebServerRequest *request) {
    GCDWebServerMultiPartFormRequest *req = (GCDWebServerMultiPartFormRequest *)request;
    for (GCDWebServerMultiPartFile *file in req.files) {
      NSString *dest = [docs stringByAppendingPathComponent:file.fileName];
      [[NSFileManager defaultManager] removeItemAtPath:dest error:nil];
      [[NSFileManager defaultManager] copyItemAtPath:file.temporaryPath toPath:dest error:nil];
      [self sendEventWithName:@"onUpload" body:@{@"name": file.fileName}];
    }
    return [GCDWebServerDataResponse responseWithHTML:@"<html><body>OK</body></html>"];
  }];

  [server addHandlerForMethod:@"GET" path:@"/"
                 requestClass:[GCDWebServerRequest class]
                 processBlock:^GCDWebServerResponse *(GCDWebServerRequest *request) {
    NSString *html = @"<html><head><meta charset='utf-8'><title>云音乐 WiFi 传歌</title></head>"
      "<body style='font-family:sans-serif;padding:24px'>"
      "<h2>云音乐 · WiFi 传歌</h2>"
      "<p>选择音乐文件（可多选），点上传即可传到手机本地。</p>"
      "<form method='post' action='/upload' enctype='multipart/form-data'>"
      "<input type='file' name='file' multiple><br><br>"
      "<button type='submit'>上传</button></form></body></html>";
    return [GCDWebServerDataResponse responseWithHTML:html];
  }];

  NSDictionary *options = @{GCDWebServerOption_AutomaticallySuspendInBackground: @NO,
                            GCDWebServerOption_Port: @8080};
  NSError *error = nil;
  if ([server startWithOptions:options error:&error]) {
    self.server = server;
    resolve([self wifiAddress]);
  } else {
    reject(@"start_fail", error.localizedDescription, error);
  }
}

RCT_EXPORT_METHOD(stopServer:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  if (self.server) { [self.server stop]; self.server = nil; }
  resolve(nil);
}

RCT_EXPORT_METHOD(getAddress:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  resolve([self wifiAddress]);
}

@end
