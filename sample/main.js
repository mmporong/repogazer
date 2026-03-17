function main() {
  const x = add(5, 10);
  const y = multiply(x, 2);
  console.log(y);
}

class Logger {
  log(msg) {
    console.log(msg);
  }
  error(msg) {
    this.log("ERROR: " + msg);
  }
}
