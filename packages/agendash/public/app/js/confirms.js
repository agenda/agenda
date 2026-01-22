const popupmessage = Vue.component("popup-message", {
  props: ["job", "deletec", "requeuec", "createc"],
  template: `
   <div v-if="deletec" class="alert alert-success popupmessage">Job Deleted successfull</div>
   <div v-else-if="requeuec" class="alert alert-success popupmessage">Job Requeue successfull</div>
   <div v-else-if="createc" class="alert alert-success popupmessage">Job Created successfull</div>
  `,
});
