var getUrlParameter = function getUrlParameter(sParam) {
    var sPageURL = decodeURIComponent(window.location.search.substring(1)),
        sURLVariables = sPageURL.split('&'),
        sParameterName,
        i;

    for (i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=');

        if (sParameterName[0] === sParam) {
            return sParameterName[1] === undefined ? true : sParameterName[1];
        }
    }
}

var width = 110
var height = 86
var connectionStatus = false
var dataLoaded = false
var whaleCount = 0
var currentData = []

var TEST_SRC = 'https://www.cadburygiftsdirect.co.uk/media/catalog/product/cache/1/image/9df78eab33525d08d6e5fb8d27136e95/m/i/mini-egg-100g-bag_1200x1200.png'

var CURRENT_IMAGE_SRC = ''

var USERS_SERVICE = 'http://127.0.0.1:8101'
var USER_ID = getUrlParameter('user') || null

function activate_page(){
  load_data(build_page)
  $('#preloader').hide()
}

function disable_page(){
  $('#preloader').show()
}

function load_data(done){
  $.get('/v1/whales', function(data){

    var ret = data.map(function(st){
      var parts = st.split(':')
      return {
        x:parts[0],
        y:parts[1]
      }
    })

    done(ret)

  })
}

function add_data(x, y, done){
  $.post('/v1/whales', x + ':' + y, done)
}

function check_status(done){
  $.get('/v1/ping', function(data){
    connectionStatus = data.connected

    if(connectionStatus){
      activate_page()
    }
    else{
      disable_page()
    }

    setTimeout(check_status, 1000)
  })
}

function add_whale(x, y, animate){
  var holder = document.getElementById('holder')
  var elem = document.createElement('div')
  $(elem).addClass('clickImage')
  whaleCount++
  if (y < 100 && whaleCount == 5) {
      $(elem).addClass('bug')
  } else {
      $(elem).addClass('whale')
  }
  $(elem).css({
    left:x + 'px',
    top:y + 'px',
    width:width + 'px',
    height:height + 'px'
  })
  if(CURRENT_IMAGE_SRC) {
    $(elem).css({
      "background-image": CURRENT_IMAGE_SRC
    })
  }
  if(animate){
    $(elem).addClass('animated tada');
  }
  holder.appendChild(elem)
  $('#clickmessage').hide()
}

function updateAllImages(src) {
  $('.clickImage').css({
    "background-image": CURRENT_IMAGE_SRC
  })
}

function setImageSrc(SRC) {
  CURRENT_IMAGE_SRC = 'url(' + SRC + ')'
}

function reset() {
  whaleCount = 0
  $('#holder').html('')
}

// will put the mobies on the screen as per state
function build_page(backendData){
  if(JSON.stringify(backendData) == JSON.stringify(currentData)) return
  reset()
  backendData.forEach(function(pos){
    add_whale(pos.x, pos.y)
  })
  currentData = backendData
}

function handle_click(e){
  if(!connectionStatus) return
  var offset = $(this).offset();
  var x = e.pageX - offset.left - (width/2);
  var y = e.pageY - offset.top - (height/2);
  add_data(x, y, function(){
    add_whale(x, y, true)
  })
}

function handle_login(e) {
  if(!connectionStatus) return
  var username = $('#login_username').val()

  function onSuccess(data) {
    USER_ID = data.Id

    $('#auth').hide()
    $('#imageupload').show()
    $('#uploadForm').attr('action', 'http://127.0.0.1:8101/users/' + USER_ID + '/image')

    setImageSrc(USERS_SERVICE + '/users/' + USER_ID + '/image')
    updateAllImages()
  }

  function runAjax() {
    $.ajax({
      type: "POST",
      url: USERS_SERVICE + '/login',
      data: JSON.stringify({
        Name: username
      }),
      dataType: 'json',
      success: onSuccess
    })
  }

  runAjax()
}

$(function(){
  $('#preloader').show()
  $('#clickmessage').show()
  $('#holder').click(handle_click)
  $('#login_button').click(handle_login)
  $('#imageupload').hide()

  if(USER_ID) {
    $('#uploadForm').attr('action', 'http://127.0.0.1:8101/users/' + USER_ID + '/image')
  }
  check_status()
  if (USER_ID !== null) {
    setImageSrc(USERS_SERVICE + '/users/' + USER_ID + '/image')
    updateAllImages()
  }
})
