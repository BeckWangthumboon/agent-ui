const args = Bun.argv.slice(2);

if (args.length === 0) {
  console.log("CLI scaffold is ready.");
} else {
  console.log(`CLI scaffold received args: ${args.join(" ")}`);
}
