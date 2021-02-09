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
var chart_data = [];
var infowindow = null;
var marker = null;

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
    metricUnit = measurementMode == "miles" ? "ft" : "m";
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
        mapTypeId: 'roadmap'
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
    }else{
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
    
    $("#chart").show();
    
    // Extract the data to populate the chart.
    chart_data=[];
    for (i = 0; i < elevations.length; i++) {
        // Change elevation from meters to feet.
        if(measurementMode === "miles"){
            feetMultiplicator = 3.28084;
        }
        else{
            feetMultiplicator = 1;
        }
        if(i < elevations.length-1){
            slope = (calcSlope(elevations[i+1].elevation, elevations[i].elevation, distance.value/299)) * 100;
        }else{
            slope = 0;
        }
        var absSlope = Math.abs(slope);
        var color = am4core.color("#000000");
        if (absSlope <= 4) {
            color = am4core.color("#3CB371");
        } else if (absSlope <= 8) {
            color =am4core.color("#FFFF00");
        } else if (absSlope <= 12) {
            color = am4core.color("#FF9800");
        } else if (absSlope <= 16) {
            color = am4core.color("#F44336");
        } 
        chart_data.push({
            id: i,
            location: elevations[i].location,
            elevation: elevations[i].elevation * feetMultiplicator,
            slope: slope,
            color: color 
        });
    }
    
    // Draw the chart using the data within its div.

    if(chart == null){
            // Themes begin
            am4core.useTheme(am4themes_animated);
            // Themes end
            
            // Create chart
            chart = am4core.create("chart", am4charts.XYChart);
            //chart.paddingRight = 20;

            chart.data = chart_data;

            /* Create axes */
            var categoryAxis = chart.xAxes.push(new am4charts.CategoryAxis());
            categoryAxis.dataFields.category = "id";
            categoryAxis.renderer.grid.template.disabled = true;
            categoryAxis.renderer.labels.template.disabled = true;
            categoryAxis.tooltip.disabled = true;

            /* Create value axis */
            var elevationAxis = chart.yAxes.push(new am4charts.ValueAxis());
            elevationAxis.title.text = "Elevation(" + metricUnit + ")";
            elevationAxis.tooltip.disabled = true;
            
            var slopeAxis = chart.yAxes.push(new am4charts.ValueAxis());
            slopeAxis.title.text = "Slope(%)";
            slopeAxis.tooltip.disabled = true;
            slopeAxis.renderer.grid.template.strokeDasharray = "2,3";
            slopeAxis.renderer.opposite = true;

            /* Create Elevation series */
            var series1 = chart.series.push(new am4charts.LineSeries());
            series1.dataFields.categoryX = "id";
            series1.dataFields.valueY = "elevation";
            series1.yAxis = elevationAxis;
            series1.xAxis = categoryAxis;
            series1.name = "Elevation";
            series1.strokeWidth = 2;
            series1.stroke = am4core.color("#275cb2");
            series1.fill = am4core.color("#6794dc");
            //series1.propertyFields.stroke = "color";

            //series1.tensionX = 0.7;
            series1.fillOpacity = 0.8;
            //series.tooltip.pointerOrientation = "vertical";
            series1.tooltipText = "Elevation: [bold]{valueY}[/]";

            /* Create Slope series */
            var series2 = chart.series.push(new am4charts.StepLineSeries());
            series2.dataFields.categoryX = "id";
            series2.dataFields.valueY = "slope";
            series2.yAxis = slopeAxis;
            series2.xAxis = categoryAxis;
            series2.name = "Slope";
            series2.strokeWidth = 1;
            series2.fillOpacity = 0.8;
            series2.fill = am4core.color("#3CB371");
            series2.propertyFields.fill = "color";
            series2.tooltipText = "Slope: [bold]{valueY}[/]";
    
            chart.cursor = new am4charts.XYCursor();
            chart.cursor.behavior = "panXY";
            chart.cursor.lineY.disabled = true;
            //chart.cursor.xAxis = categoryAxis;
            //chart.cursor.snapToSeries = series;
            chart.cursor.events.on("cursorpositionchanged", function(ev) {
                var xAxis = ev.target.chart.xAxes.getIndex(0);
                var id = xAxis.positionToCategory(xAxis.toAxisPosition(ev.target.xPosition));
                if(id == undefined) return;
                // Show location on the map.
                var location = chart_data[id].location;
                var elevation = chart_data[id].elevation;
                var slope = chart_data[id].slope;
                var contentString = "Elevation: " + Math.round(elevation) + " " + metricUnit + "<br>" +
                    "Slope: " + Math.round(slope) + "% (" + deg(slope) + "&#176;)";
                if(marker == null){
                    marker = new google.maps.Marker({
                        position: location,
                        map: map
                    });
                }else{
                    marker.setPosition(location);
                }
                if(infowindow == null){
                    infowindow = new google.maps.InfoWindow({
                        content: contentString
                    });
                    infowindow.open(map, marker);
                }else{
                    infowindow.setContent(contentString);
                    if(infowindow.getMap()){
                        infowindow.setPosition(marker.getPosition());
                    }else{
                        infowindow.open(map, marker);
                    }
                }
            });

            chart.scrollbarX = new am4charts.XYChartScrollbar();
            chart.scrollbarX.series.push(series1);
            chart.scrollbarX.fontSize = 0;
            
            // Add legend
            chart.legend = new am4charts.Legend();
            //chart.legend.parent = chart.plotContainer;
            //chart.legend.zIndex = 100;
            
            chart.events.on("datavalidated", function () {
                categoryAxis.zoom({start:0, end:1});
                elevationAxis.title.text = "Elevation(" + metricUnit + ")";
            });
    }else{
        chart.data = chart_data;
        chart.validateData();
    } 
    
    drawPolyline(chart_data);
}


function removePolylines() {
    for (var i = 0; i < mapPaths.length; i++) {
        var path = mapPaths[i];
        path.setMap(null);
    }

    mapPaths = [];
}

function drawPolyline (chart_data) {
    // Create a polyline between each elevation, color code by slope.
    // Remove any existing polylines before drawing a new polyline.
    removePolylines();

    for (var i = 0; i < chart_data.length -1; i++) {
        var routePath = [
            chart_data[i].location,
            chart_data[i+1].location
        ];
        mapPath = new google.maps.Polyline({
            path: routePath,
            strokeColor: chart_data[i].color,
            strokeOpacity: 0.8,
            strokeWeight: 5,
            draggable: true
        });
        mapPath.setMap(map);
        mapPaths.push(mapPath);
    }
}

function deg(slope) {
    return Math.floor(Math.atan(slope/100)*180/Math.PI);
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
