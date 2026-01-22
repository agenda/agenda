const confirmRequeueMulti = Vue.component("confirm-multi-requeue", {
  props: ["jobs"],
  methods: {
    RequeueMulti(ids) {
      const url = `api/jobs/requeue`;
      let body = { jobIds: ids };
      return axios
        .post(url, body)
        .then((result) => result.data)
        .then((data) => {
          this.$emit("popup-message");
          this.$emit("refresh-data");
          this.$emit("ready-clean");
        })
        .catch(console.log);
    },
  },
  template: `
  <div class="modal fade" id="modalRequeueSureMulti" tabindex="-1" role="dialog" aria-labelledby="exampleModalLabel" aria-hidden="true">
      <!-- Modal -->
      <h1>MULTI</h1>
    <div class="modal-dialog" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="exampleModalLabel">Confirm requeue job</h5>
          <button type="button" class="close" data-dismiss="modal" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div class="modal-body">
          <div class="row px-3" v-for="job in jobs">
            <div class="col">
              <p>Job Id: {{job}}</p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-info" data-dismiss="modal" @click="RequeueMulti(jobs)">Requeue Job</button>
          <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
        </div>
      </div>
    </div>
  </div>
  `,
});
