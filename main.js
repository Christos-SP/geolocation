/* global L Papa */

/*
 * Script to display two tables from Google Sheets as point and geometry layers using Leaflet
 * The Sheets are then imported using PapaParse and overwrite the initially laded layers
 */

// PASTE YOUR URLs HERE
// these URLs come from Google Sheets 'shareable link' form
// the first is the geometry layer and the second the points

//let geomURL = "https://google.com";
//let pointsURL = "https://google.com";

let geomURL = "leaflet_geoms2.csv";      
let pointsURL = "leaflet_points2.csv";  



window.addEventListener("DOMContentLoaded", init);

let map;
let sidebar;
let panelID = "my-info-panel";

/*
 * init() is called when the page has loaded
 */
function init() {
  // Create a new Leaflet map centered on Thessaloniki
  map = L.map("map").setView([40.631, 22.954], 14);

  // This is the Carto Positron basemap
  L.tileLayer(
    "https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution:
        "&copy; <a href='http://openstreetmap.org'>OpenStreetMap</a> &copy; <a href='http://cartodb.com'>CartoDB</a>",
      subdomains: "abcd",
      maxZoom: 19,
    }
  ).addTo(map);

 
  sidebar = L.control
    .sidebar({
      container: "sidebar",
      closeButton: true,
      position: "right",
    })
    .addTo(map);

  let panelContent = {
    id: panelID,
    tab: "<i class='fa fa-bars active'></i>",
    pane: "<p id='sidebar-content'></p>",
    title: "<h2 id='sidebar-title'>Nothing selected</h2>",
  };
  sidebar.addPanel(panelContent);

  map.on("click", function () {
    sidebar.close(panelID);
  });



  // Use PapaParse to load data from Google Sheets
  // And call the respective functions to add those to the map.
  Papa.parse(geomURL, {
    download: true,
    header: true,
    complete: addGeoms,
  });
  Papa.parse(pointsURL, {
    download: true,
    header: true,
    complete: addPoints,
  });
  
  // Ζητάει από τον browser την τοποθεσία του χρήστη
  map.locate({ 
      setView: false,   // Μεταφέρει αυτόματα τον χάρτη στη θέση του χρήστη
      maxZoom: 16      // Ορίζει το επίπεδο zoom κατά την εύρεση
  });

  // Μόλις βρεθεί η τοποθεσία δημιουργεί έναν marker στη θέση του χρήστη
  map.on('locationfound', function(e) {
      L.marker(e.latlng)
       .addTo(map)
       .bindPopup("Βρίσκεστε εδώ!")
       .openPopup();
  });

  // Διαχείριση σφάλματος (αν ο χρήστης αρνηθεί την πρόσβαση)
  map.on('locationerror', function(e) {
      alert("Δεν ήταν δυνατός ο εντοπισμός της θέσης σας: " + e.message);
  });

  // =====================================================================
  // ΑΛΛΑΓΗ ΕΔΩ: Καλούμε τη νέα συνάρτηση ΜΟΝΟ όταν σταματάει η κίνηση (moveend)
  // =====================================================================
  map.on("moveend", fetchOSMData);
  loadPublicPOIs(); // Εκτέλεση μία φορά στην αρχή για να φορτώσει αμέσως
  
}



/*
 * Expects a JSON representation of the table with properties columns
 * and a 'geometry' column that can be parsed by parseGeom()
 */
function addGeoms(data) {
  data = data.data;
  // Need to convert the PapaParse JSON into a GeoJSON
  // Start with an empty GeoJSON of type FeatureCollection
  // All the rows will be inserted into a single GeoJSON
  let fc = {
    type: "FeatureCollection",
    features: [],
  };

  for (let row in data) {
    // The Sheets data has a column 'include' that specifies if that row should be mapped
    if (data[row].include == "y") {
      let features = parseGeom(JSON.parse(data[row].geometry));
      features.forEach((el) => {
        el.properties = {
          name: data[row].name,
          description: data[row].description,
        };
        fc.features.push(el);
      });
    }
  }

  // The geometries are styled slightly differently on mouse hovers
  let geomStyle = { color: "#2ca25f", fillColor: "#99d8c9", weight: 2 };
  let geomHoverStyle = { color: "green", fillColor: "#2ca25f", weight: 3 };

  L.geoJSON(fc, {
    onEachFeature: function (feature, layer) {
      layer.on({
        mouseout: function (e) {
          e.target.setStyle(geomStyle);
        },
        mouseover: function (e) {
          e.target.setStyle(geomHoverStyle);
        },
        click: function (e) {
          // This zooms the map to the clicked geometry
          // Uncomment to enable
          // map.fitBounds(e.target.getBounds());

          // if this isn't added, then map.click is also fired!
          L.DomEvent.stopPropagation(e);

          document.getElementById("sidebar-title").innerHTML =
            e.target.feature.properties.name;
          document.getElementById("sidebar-content").innerHTML =
            e.target.feature.properties.description;
          sidebar.open(panelID);
        },
      });
    },
    style: geomStyle,
  }).addTo(map);
}

/*
 * addPoints is a bit simpler, as no GeoJSON is needed for the points
 */
/*
 * addPoints is a bit simpler, as no GeoJSON is needed for the points
 */
function addPoints(data) {
  data = data.data;
  let pointGroupLayer = L.layerGroup().addTo(map);

  let markerType = "marker";
  let markerRadius = 100;

  for (let row = 0; row < data.length; row++) {
    // =====================================================================
    // ΕΛΕΓΧΟΣ: Αν το lat ή το lon λείπουν ή είναι κενά, προσπέρνα τη γραμμή
    // =====================================================================
    if (!data[row] || data[row].lat === undefined || data[row].lon === undefined || data[row].lat === "" || data[row].lon === "") {
      console.warn(`Παράλειψη γραμμής ${row}: Ελλιπείς συντεταγμένες (lat/lon).`);
      continue; 
    }

    let marker;
    if (markerType == "circleMarker") {
      marker = L.circleMarker([data[row].lat, data[row].lon], {
        radius: markerRadius,
      });
    } else if (markerType == "circle") {
      marker = L.circle([data[row].lat, data[row].lon], {
        radius: markerRadius,
      });
    } else {
      marker = L.marker([data[row].lat, data[row].lon]);
    }
    marker.addTo(pointGroupLayer);

    marker.feature = {
      properties: {
        name: data[row].name || "Χωρίς όνομα",
        description: data[row].description || "",
      },
    };
    marker.on({
      click: function (e) {
        L.DomEvent.stopPropagation(e);
        document.getElementById("sidebar-title").innerHTML =
          e.target.feature.properties.name;
        document.getElementById("sidebar-content").innerHTML =
          e.target.feature.properties.description;
        sidebar.open(panelID);
      },
    });

    // AwesomeMarkers
    if (typeof L.AwesomeMarkers !== 'undefined' && data[row].color) {
        let icon = L.AwesomeMarkers.icon({
          icon: "info-circle",
          iconColor: "white",
          markerColor: data[row].color,
          prefix: "fa",
          extraClasses: "fa-rotate-0",
        });
        if (!markerType.includes("circle")) {
          marker.setIcon(icon);
        }
    }
  }
}
/*
 * Accepts any GeoJSON-ish object and returns an Array of
 * GeoJSON Features. Attempts to guess the geometry type
 * when a bare coordinates Array is supplied.
 */
function parseGeom(gj) {
  // FeatureCollection
  if (gj.type == "FeatureCollection") {
    return gj.features;
  }

  // Feature
  else if (gj.type == "Feature") {
    return [gj];
  }

  // Geometry
  else if ("type" in gj) {
    return [{ type: "Feature", geometry: gj }];
  }

  // Coordinates
  else {
    let type;
    if (typeof gj == "number") {
      type = "Point";
    } else if (typeof gj == "number") {
      type = "LineString";
    } else if (typeof gj == "number") {
      type = "Polygon";
    } else {
      type = "MultiPolygon";
    }
    return [{ type: "Feature", geometry: { type: type, coordinates: gj } }];
  }
}


