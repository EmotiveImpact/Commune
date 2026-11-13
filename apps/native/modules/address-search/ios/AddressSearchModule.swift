import ExpoModulesCore
import MapKit

/// Address suggestions from Apple Maps, the same search the Maps app uses.
/// Free, with no key. `suggest` returns up to five matches for what has been
/// typed; `resolve` turns one of them into a full address with its postcode.
public class AddressSearchModule: Module {
  private lazy var searcher = Searcher()

  public func definition() -> ModuleDefinition {
    Name("AddressSearch")

    AsyncFunction("suggest") { (query: String, promise: Promise) in
      self.searcher.suggest(query, promise: promise)
    }.runOnQueue(.main)

    AsyncFunction("resolve") { (index: Int, promise: Promise) in
      self.searcher.resolve(index, promise: promise)
    }.runOnQueue(.main)
  }
}

final class Searcher: NSObject, MKLocalSearchCompleterDelegate {
  private let none: [[String: String]] = []
  private let completer = MKLocalSearchCompleter()
  private var pending: Promise?
  private var results: [MKLocalSearchCompletion] = []

  override init() {
    super.init()
    completer.delegate = self
    completer.resultTypes = .address
  }

  func suggest(_ query: String, promise: Promise) {
    // A newer query replaces an older one that has not answered yet.
    pending?.resolve(none)
    let text = query.trimmingCharacters(in: .whitespacesAndNewlines)
    if text.count < 3 {
      pending = nil
      results = []
      promise.resolve(none)
      return
    }
    if text == completer.queryFragment && !completer.isSearching {
      pending = nil
      promise.resolve(rows())
      return
    }
    pending = promise
    completer.queryFragment = text
  }

  func resolve(_ index: Int, promise: Promise) {
    guard index >= 0 && index < results.count else {
      promise.resolve(nil as String?)
      return
    }
    let completion = results[index]
    let request = MKLocalSearch.Request(completion: completion)
    request.resultTypes = .address
    MKLocalSearch(request: request).start { response, _ in
      guard let mark = response?.mapItems.first?.placemark else {
        promise.resolve(nil as String?)
        return
      }
      let street = [mark.subThoroughfare, mark.thoroughfare].compactMap { $0 }.joined(separator: " ")
      let town = [mark.locality, mark.postalCode].compactMap { $0 }.joined(separator: " ")
      let parts = [street, mark.subLocality ?? "", town].filter { !$0.isEmpty }
      var seen = Set<String>()
      let line = parts.filter { seen.insert($0).inserted }.joined(separator: ", ")
      promise.resolve(line.isEmpty ? nil : line)
    }
  }

  func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
    results = Array(completer.results.prefix(5))
    pending?.resolve(rows())
    pending = nil
  }

  func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
    results = []
    pending?.resolve(none)
    pending = nil
  }

  private func rows() -> [[String: String]] {
    return results.map { ["title": $0.title, "subtitle": $0.subtitle] }
  }
}
