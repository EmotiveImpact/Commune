Pod::Spec.new do |s|
  s.name           = 'AddressSearch'
  s.version        = '1.0.0'
  s.summary        = 'Address suggestions from Apple Maps for the commune address box'
  s.description    = 'Wraps MKLocalSearchCompleter and MKLocalSearch for Commune.'
  s.author         = 'Commune'
  s.homepage       = 'https://ourcommune.io'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'MapKit'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files   = '**/*.{h,m,mm,swift}'
end
