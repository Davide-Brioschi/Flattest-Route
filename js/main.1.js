var directionsDisplay;
var map = null;
var elevator = null;
var polyline;
var routes = null;
var slopes = null;
var distance = null;
var duration = null;
var markersArray = [];
var elevations = [];
var mapPaths = [];
var measurementMode;
var metricUnit = null;
var feetMultiplicator = null;

var chart = null;

// Runs after page is loaded.
$(function () {
    var from = getURLParameter('from');
    var to = getURLParameter('to');
    var travelMode = getURLParameter('travelMode');
    measurementMode = getURLParameter('measurementMode');

    // If this link is being shared set to and from
    if (from != "null") {
        $('#from').val(decodeURLParameter(from));
    }

    if (to != "null") {
        $('#to').val(decodeURLParameter(to));
    }

    if (travelMode != "null") {
        $('#travel-mode').val(decodeURLParameter(travelMode));
    }

    if (measurementMode === 'null') {
        measurementMode = 'miles';
    } else {
        $('#measurement-mode').val(decodeURLParameter(measurementMode));
    }

    $("#from-to-switcher").on("click", function (e) {
        var $fromInput = $("#from");
        var $toInput = $("#to");
        var oldFromVal = $fromInput.val();
        $fromInput.val($toInput.val());
        $toInput.val(oldFromVal);
    });

    //  Create event handler that will start the calcRoute function when
    //  the go button is clicked.
    $("form#routes").on("submit", function (e) {

        measurementMode = $("#measurement-mode").val();
        metricUnit = measurementMode == "miles" ? "ft" : "m";
        e.preventDefault();
        calcRoute();
    });

    initialize_maps();
    initAutoComplete('from');
    initAutoComplete('to');

    if (from != "null" && to != "null") {
        calcRoute();
    }
});

function initialize_maps() {
    // Set ability to make route draggable.
    var rendererOptions = {
        draggable: true,
        hideRouteList: true,
        polylineOptions: {
            strokeOpacity: 0
        }
    };
    // Initialize the directions renderer.
    directionsDisplay = new google.maps.DirectionsRenderer(rendererOptions);
    var mapCanvas = $('#map-canvas').get(0);
    var mapOptions = {
        center: new google.maps.LatLng(37.787930,-122.4074990),
        zoom: 13,
        // Disables zoom and streetview bar but can stil zoom with mouse.
        disableDefaultUI: false,
        mapTypeId: google.maps.MapTypeId.HYBRID
    };
    // Create a google maps object.
    map = new google.maps.Map(mapCanvas, mapOptions);
    directionsDisplay.setMap(map);
    // Add elevation service.
    elevator = new google.maps.ElevationService();

    // Set up listener to change path elevation information if the user
    // clicks on another suggested route.
    google.maps.event.addListener(
        directionsDisplay,
        'directions_changed',
        updateRoutes
    );
}

function initAutoComplete(field) {
    var input = document.getElementById(field);
    autocomplete = new google.maps.places.Autocomplete(input);

    // Prevent form submission when selecting place with enter.
    // http://stackoverflow.com/questions/11388251/google-autocomplete-enter-to-select
    $('#' + field).keydown(function (e) {
      if (e.which == 13 && $('.pac-container:visible').length)
        return false;
    });
}

function calcRoute() {
    var unitSystem = google.maps.UnitSystem.IMPERIAL;
    var start = $("#from").val() || $("#from").attr("placeholder");
    var end = $("#to").val() || $("#to").attr("placeholder");
    var travelMode = $("#travel-mode").val();
    if (measurementMode === "km") {
      unitSystem = google.maps.UnitSystem.METRIC;
    };
    var request = {
        origin: start,
        destination: end,
        unitSystem: unitSystem,
        travelMode: google.maps.TravelMode[travelMode.toUpperCase()]
    };
    var DirectionsService = new google.maps.DirectionsService();
    DirectionsService.route(request, function(result, status) {
        if (status === "NOT_FOUND") {
            alert("No directions found.");
            return;
        }
        // Checks region for directions eligibility.
        if (status == google.maps.DirectionsStatus.OK) {
            directionsDisplay.setDirections(result);
        }
    });
    sharableLink(start, end, travelMode);
}
function sharableLink(start, end, travelMode) {
    // Update url to include sharable link
    history.replaceState('null', 'Flat Route Finder', '?from=' + encodeURLParameter(start) + '&to=' + encodeURLParameter(end) +
        '&travelMode=' + travelMode + '&measurementMode=' + measurementMode);
}

function updateRoutes() {
    // Check if the path has been populated, if it has been already
    // populated, clear it.

    var routes = this.directions.routes;
    var path = routes[this.routeIndex].overview_path;
    distance = routes[this.routeIndex].legs[0].distance;
    duration = routes[this.routeIndex].legs[0].duration;

    /* Shows distance in miles or kilometres, depending on measurement mode. */
    if(measurementMode == "miles"){
        $("#distance").html(distance.text);
    }
    else{
        $("#distance").html((distance.value / 1000) + "Km");
    }

    $("#travel-time").html(duration.text);
    $(".travel-info").show();
    newPath(path, distance.value);
}

function newPath(path) {
    var pathRequest = {
        'path': path,
        'samples': 300
    };
        // Initiate the path request.
    elevator.getElevationAlongPath(pathRequest, plotElevation);
}
// Take an array of elevation result objects, draws a path on the map
// and plots the elevation profile on the chart.
function plotElevation(elevations, status) {
    if (status !== google.maps.ElevationStatus.OK) {
        alert("Error getting elevation data from Google");
        return;
    }
    // Create a new chart in the elevation chart div.
    $("#elevation_chart").css('display','block');
    // Extract the data to populate the chart.
    var chart_data=[];
    for (i = 0; i < elevations.length; i++) {
        // Change elevation from meters to feet.
        if(measurementMode === "miles"){
            feetMultiplicator = 3.28084;
        }else{
            feetMultiplicator = 1;
        }
        slope = (calcSlope(elevations[i+1].elevation, elevations[i].elevation, distance.value/300)) * 100;
        chart_data.push({
            id: i,
            location: elevations[i].location,
            elevation: elevations[i].elevation * feetMultiplicator,
            slope: slope,
        });
    }
    
    // Draw the chart using the data within its div.

    if(elevation_chart == null){
       // am4core.ready(function() {

            // Themes begin
            am4core.useTheme(am4themes_animated);
            // Themes end
            
            // Create chart
            elevation_chart = am4core.create("elevation_chart", am4charts.XYChart);
            //elevation_chart.paddingRight = 20;

            elevation_chart.data = elevation_data;

            /* Create axes */
            var categoryAxis = elevation_chart.xAxes.push(new am4charts.CategoryAxis());
            categoryAxis.dataFields.category = "id";
            categoryAxis.renderer.grid.template.disabled = true;
            categoryAxis.renderer.labels.template.disabled = true;
            categoryAxis.tooltip.disabled = true;

            /* Create value axis */
            var valueAxis = elevation_chart.yAxes.push(new am4charts.ValueAxis());
            valueAxis.title.text = "Elevation(m)";
            valueAxis.tooltip.disabled = true;

            /* Create series */
            var series = elevation_chart.series.push(new am4charts.LineSeries());
            series.dataFields.categoryX = "id";
            series.dataFields.valueY = "elevation";
            series.name = "Elevation";
            series.strokeWidth = 1;
            //series.tensionX = 0.7;
            series.fillOpacity = 0.3;
            //series.tooltip.pointerOrientation = "vertical";
            series.tooltipText = "Elevation: [bold]{valueY}[/]";
    
    
            elevation_chart.cursor = new am4charts.XYCursor();
            elevation_chart.cursor.behavior = "panXY";
            elevation_chart.cursor.lineY.disabled = true;
            //elevation_chart.cursor.xAxis = categoryAxis;
            //elevation_chart.cursor.snapToSeries = series;
    
            elevation_chart.scrollbarX = new am4charts.XYChartScrollbar();
            elevation_chart.scrollbarX.series.push(series);

            // Add vertical scrollbar
            //elevation_chart.scrollbarY = new am4core.Scrollbar();
            //elevation_chart.scrollbarY.marginLeft = 0;
            //elevation_chart.scrollbarY.parent = elevation_chart.leftAxesContainer;

            elevation_chart.events.on("datavalidated", function () {
                categoryAxis.zoom({start:0, end:1});
            });
            /*
            // Fix axis scale on load
            elevation_chart.events.on("ready", function(ev) {
                valueAxis.min = valueAxis.minZoomed;
                valueAxis.max = valueAxis.maxZoomed;
            });
            */
      // }); // end am4core.ready()
    }else{
        elevation_chart.data = elevation_data;
        elevation_chart.validateData();
    } 
    
    //plotSlope(elevations);
}

function plotSlope(elevations){
    slopeChartDiv = $("#slope_chart").css('display', 'block');
   
    slopes = [];
    for (i = 0; i < elevations.length - 1; i++) {
        slope = (calcSlope(elevations[i+1].elevation, elevations[i].elevation, distance.value/300)) * 100;
        //map.slopeData.addRow(['', slope]);
        slopes.push({
            id: i,
            slope: slope,
            location: midpoint(elevations[i], elevations[i+1])
        });
    }

   // Draw the chart using the slope data within its div.
    if(slope_chart == null){
            // Create chart
            slope_chart = am4core.create("slope_chart", am4charts.XYChart);
            slope_chart.paddingRight = 20;
    
            slope_chart.data = slopes;
    
             /* Create axes */
             var categoryAxis = slope_chart.xAxes.push(new am4charts.CategoryAxis());
             categoryAxis.dataFields.category = "id";
             categoryAxis.renderer.grid.template.disabled = true;
             categoryAxis.renderer.labels.template.disabled = true;
             categoryAxis.tooltip.disabled = true;
    
            var valueAxis = slope_chart.yAxes.push(new am4charts.ValueAxis());
            valueAxis.tooltip.disabled = true;
            valueAxis.title.text = "Slope(%)";
    
            var series = slope_chart.series.push(new am4charts.LineSeries());
            series.dataFields.categoryX = "id";
            series.dataFields.valueY = "slope";
            series.tooltipText = "Slope: [bold]{valueY}[/]";
            series.fillOpacity = 0.3;
            //series.tooltip.pointerOrientation = "vertical";
    
    
            slope_chart.cursor = new am4charts.XYCursor();
            slope_chart.cursor.behavior = "panXY";
            slope_chart.cursor.lineY.disabled = true;
            //slope_chart.cursor.xAxis = categoryAxis;
            //slope_chart.cursor.snapToSeries = series;
    
            slope_chart.scrollbarX = new am4charts.XYChartScrollbar();
            slope_chart.scrollbarX.series.push(series);

            slope_chart.events.on("datavalidated", function () {
                categoryAxis.zoom({start:0, end:1});
            });
    }else{
        slope_chart.data = slopes;
        slope_chart.validateData();
    } 

    $('.chart').removeClass('hide');
    //slopeChart = null;
    drawPolyline(elevations, slopes);
}

function removePolylines() {
    for (var i = 0; i < mapPaths.length; i++) {
        var path = mapPaths[i];
        path.setMap(null);
    }

    mapPaths = [];
}

function drawPolyline (elevations, slopes) {
    // Create a polyline between each elevation, color code by slope.
    // Remove any existing polylines before drawing a new polyline.
    removePolylines();

    for (var i = 0; i < slopes.length; i++) {
        var routePath = [
            elevations[i].location,
            elevations[i+1].location
        ];
        var absSlope = Math.abs(slopes[i].slope);
        if (absSlope <= 5) {
            pathColor = "#3CB371";
        } else if (absSlope <= 10) {
            pathColor = "#FFFF00";
        } else if (absSlope <= 15) {
            pathColor = "#FF9800";
        } else if (absSlope <= 20) {
            pathColor = "#F44336";
        }
        else {
            pathColor = "#000000";
        }
        mapPath = new google.maps.Polyline({
            path: routePath,
            strokeColor: pathColor,
            strokeOpacity: 0.8,
            strokeWeight: 5,
            draggable: true
        });
        mapPath.setMap(map);
        mapPaths.push(mapPath);
    }
}

function deg(slope) {
    return Math.floor(slope * 45) / 100;
}

function elevationHover (x) {
    // Show location on the map.
    var location = map.elevationData.locations[x.row];
    var elevation = map.elevationData.elevation[x.row];
    var slope = slopes[x.row].slope;
    var contentString = "Elevation: " + Math.round(elevation) + " " + metricUnit + "<br>" +
        "Slope: " + Math.round(slope) + "% (" + deg(slope) + "&#176;)";

    map.locationMarker = new google.maps.Marker({
        position: location,
        map: map,
        labelContent: "Lat: " + location.lat() + ". Lng: " + location.lng() +
            ". Elevation: " + elevation
    });
    addinfoWindow(contentString);
}
function addinfoWindow(contentString) {
    // Add info window to the map.
    map.infowindow = new google.maps.InfoWindow({
        content: contentString
    });
    map.infowindow.open(map, map.locationMarker);
}
function elevationClear (x) {
    map.locationMarker.setMap(null);
}

function midpoint(point1, point2) {
    // To get the midpoint, find the average between each respective point
    var lat = (point1.location.lat() + point2.location.lat()) / 2;
    var lng = (point1.location.lng() + point2.location.lng()) / 2;
    return new google.maps.LatLng(lat, lng);
}

// Calculate slope using elevation change between two points
// over a given distance in m, the distance between each measurement.
function calcSlope(elev1M, elev2M, distanceM) {
    slope = (elev1M - elev2M) / distanceM;
    return slope;
}

// Gets the 'to' and 'from' url Parameter for sharing links
// Source: http://stackoverflow.com/questions/1403888/get-url-parameter-with-jquery
function getURLParameter(name) {
    return decodeURIComponent((RegExp(name + '=' + '(.+?)(&|$)')
        .exec(location.search)||[,null])[1]);
}

//change spaces to plus(+) sign
function encodeURLParameter(str) {
  return encodeURIComponent(str).replace(/%20/g, "+");
}

//change plus(+) sign to spaces
function decodeURLParameter(str) {
  return decodeURIComponent(str).replace(/[!'()]/g, escape)
    .replace(/\+/g, " ");
}
