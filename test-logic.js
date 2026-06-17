const sourceIds = [];
const zohoJobIdParam = "12345";

if ((sourceIds && sourceIds.length > 0) || zohoJobIdParam) {
    console.log("distribute-job WILL execute!");
} else {
    console.log("distribute-job WILL NOT execute.");
}
