/* SHOW PASSWORD */
function togglePassword(){
  const pass = document.getElementById("password");
  pass.type = pass.type === "password" ? "text" : "password";
}

/* LOGIN */
function loginUser(){

  localStorage.setItem("isLoggedIn", "true");

  alert("Login Successful");

  window.location.href = "index.html";
}
