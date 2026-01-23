const confirmDelete = Vue.component("confirm-delete", {
  props: ["job"],
  methods: {
    deleteOne(id) {
      const url = `api/jobs/delete`;
      let body = { jobIds: [id] };
      return axios
        .post(url, body)
        .then((result) => result.data)
        .then((data) => {
          this.$emit("popup-message", "delete");
          this.$emit("refresh-data");
        })
        .catch(console.log);
    },
  },
  template: `
  <div class="modal fade" id="modalDeleteSure" tabindex="-1" role="dialog" aria-labelledby="exampleModalLabel" aria-hidden="true">
      <!-- Modal -->
    <div class="modal-dialog" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="exampleModalLabel">Confirm Delete Permanently</h5>
          <button type="button" class="close" data-dismiss="modal" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div class="modal-body">
          <p>ID: {{job.job._id}}</p>
          <p>Name: {{job.job.name}}</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-danger" data-dismiss="modal" @click="deleteOne(job.job._id)">Delete</button>
          <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
        </div>
      </div>
    </div>
  </div>
  `,
});
